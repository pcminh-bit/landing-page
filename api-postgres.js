const {
  getSql,
  ensurePgSchema,
  loadSnapshot,
  saveSnapshot,
  nextId,
  nowSqliteStyle,
} = require("./pg-store");
const { notifyWaitlistSignup, sendOrderCreatedConfirmation } = require("./resend-mail");
const {
  runWaitlistSignupSequence,
  processDueJobsPostgres,
  cronEmailSequenceUnauthorized,
} = require("./email-sequence");

function sortByIdDesc(rows) {
  return [...rows].sort((a, b) => Number(b.id) - Number(a.id));
}

function sameId(a, b) {
  return Number(a) === Number(b);
}

function enrichOrders(snapshot) {
  return sortByIdDesc(snapshot.orders).map((o) => ({
    id: o.id,
    customer_id: o.customer_id,
    product_id: o.product_id,
    amount: o.amount,
    status: o.status,
    order_code: o.order_code ?? null,
    purchased_at: o.purchased_at || "",
    customer_name:
      snapshot.customers.find((c) => sameId(c.id, o.customer_id))?.name ?? null,
    product_name:
      snapshot.products.find((p) => sameId(p.id, o.product_id))?.name ?? null,
  }));
}

function extractTransferMemoFromPayload(payload) {
  if (!payload || typeof payload !== "object") return "";
  const parts = [
    payload.content,
    payload.description,
    payload.note,
    payload.transferDescription,
    payload.message,
    payload.referenceCode,
  ];
  return parts
    .filter((p) => p != null && String(p).trim() !== "")
    .map((p) => String(p))
    .join(" ")
    .toUpperCase();
}

/** Chỉ khớp khi đủ chuỗi order_code có trong nội dung chuyển khoản. */
function findOrderByTransfer(snapshot, memoUpper) {
  const normalizedContent = String(memoUpper || "").toUpperCase();
  const pending = sortByIdDesc(
    snapshot.orders.filter(
      (o) => o.status === "pending" && String(o.order_code || "").trim() !== ""
    )
  );

  for (const order of pending) {
    const code = String(order.order_code || "").toUpperCase().trim();
    if (code && normalizedContent.includes(code)) return order;
  }

  return null;
}

function ensureDefaultProduct(snapshot) {
  if (snapshot.products.length) return snapshot.products[0].id;
  const id = 1;
  snapshot.products.push({
    id,
    name: "Thanh toan hoc bong",
    price: 1000,
    description: "San pham mac dinh cho thanh toan online",
    stock_quantity: 999999,
    created_at: nowSqliteStyle(),
  });
  return id;
}

function generateOrderCode() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900 + 100);
  return `DH${timestamp}${random}`;
}

async function handleApiPostgres(req, res, url, deps) {
  const { sendJson, readJsonBody, readJsonBodyWithRaw } = deps;
  const sql = getSql();

  await ensurePgSchema(sql);

  async function mutate(fn) {
    const snapshot = await loadSnapshot(sql);
    const result = await fn(snapshot);
    await saveSnapshot(sql, snapshot);
    return result;
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/cron/email-sequence") {
      const cronChk = cronEmailSequenceUnauthorized(req, url);
      if (cronChk.reason === "no_secret") {
        return sendJson(res, 503, { error: "CRON_SECRET chưa cấu hình." });
      }
      if (!cronChk.ok) {
        return sendJson(res, 401, { error: "Unauthorized" });
      }
      const processed = await processDueJobsPostgres(mutate);
      return sendJson(res, 200, { ok: true, processed });
    }

    if (req.method === "GET" && url.pathname === "/api/products") {
      const snapshot = await loadSnapshot(sql);
      return sendJson(res, 200, sortByIdDesc(snapshot.products));
    }

    if (req.method === "GET" && url.pathname === "/api/customers") {
      const snapshot = await loadSnapshot(sql);
      return sendJson(res, 200, sortByIdDesc(snapshot.customers));
    }

    if (req.method === "GET" && url.pathname === "/api/orders") {
      const snapshot = await loadSnapshot(sql);
      return sendJson(res, 200, enrichOrders(snapshot));
    }

    if (req.method === "POST" && url.pathname === "/api/products") {
      const body = await readJsonBody(req);
      if (!body.name || body.price === undefined) {
        return sendJson(res, 400, { error: "name và price là bắt buộc" });
      }
      const stock = Number(body.stock_quantity || 0);
      const price = Number(body.price);
      if (
        !Number.isFinite(stock) ||
        stock < 0 ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return sendJson(res, 400, { error: "price/stock_quantity không hợp lệ" });
      }
      await mutate((snap) => {
        const id = nextId(snap.products);
        snap.products.push({
          id,
          name: body.name.trim(),
          price,
          description: body.description || "",
          stock_quantity: stock,
          created_at: nowSqliteStyle(),
        });
      });
      return sendJson(res, 201, { ok: true });
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/products/")) {
      const id = Number(url.pathname.split("/").pop());
      const body = await readJsonBody(req);
      if (!id || !body.name || body.price === undefined) {
        return sendJson(res, 400, { error: "Dữ liệu cập nhật không hợp lệ" });
      }
      const stock = Number(body.stock_quantity || 0);
      const price = Number(body.price);
      await mutate((snap) => {
        const p = snap.products.find((x) => x.id === id);
        if (!p) throw new Error("San pham khong ton tai");
        p.name = body.name.trim();
        p.price = price;
        p.description = body.description || "";
        p.stock_quantity = stock;
      });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/products/")) {
      const id = Number(url.pathname.split("/").pop());
      try {
        await mutate((snap) => {
          if (snap.orders.some((o) => o.product_id === id)) {
            throw new Error("Không xóa được sản phẩm đã có trong đơn hàng.");
          }
          snap.products = snap.products.filter((p) => p.id !== id);
        });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/customers") {
      const body = await readJsonBody(req);
      if (!body.name) {
        return sendJson(res, 400, { error: "name là bắt buộc" });
      }
      const lead = {
        name: body.name.trim(),
        email: String(body.email || "").trim(),
        phone: body.phone || "",
        zalo: body.zalo || "",
      };
      await mutate((snap) => {
        const id = nextId(snap.customers);
        snap.customers.push({
          id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          zalo: lead.zalo,
          registered_at: body.registered_at || nowSqliteStyle(),
        });
      });
      const emailTasks = await Promise.allSettled([
        notifyWaitlistSignup(lead),
        runWaitlistSignupSequence(lead, { postgresMutate: mutate }),
      ]);
      for (const task of emailTasks) {
        if (task.status !== "rejected") continue;
        const err = task.reason;
        console.error("[email-flow] customer signup email task failed", {
          message: err?.message || String(err),
          response: err?.response || null,
        });
      }
      return sendJson(res, 201, { ok: true });
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/customers/")) {
      const id = Number(url.pathname.split("/").pop());
      const body = await readJsonBody(req);
      if (!id || !body.name) {
        return sendJson(res, 400, { error: "Dữ liệu cập nhật không hợp lệ" });
      }
      await mutate((snap) => {
        const c = snap.customers.find((x) => x.id === id);
        if (!c) throw new Error("Khach hang khong ton tai");
        c.name = body.name.trim();
        c.phone = body.phone || "";
        c.email = String(body.email || "").trim();
        c.zalo = body.zalo || "";
        if (body.registered_at) c.registered_at = body.registered_at;
      });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/customers/")) {
      const id = Number(url.pathname.split("/").pop());
      try {
        await mutate((snap) => {
          if (snap.orders.some((o) => o.customer_id === id)) {
            throw new Error("Khách hàng này đã có đơn hàng, không thể xóa.");
          }
          snap.customers = snap.customers.filter((c) => c.id !== id);
        });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/orders") {
      const body = await readJsonBody(req);
      const customerId = Number(body.customer_id);
      const productId = Number(body.product_id);
      const amount = Number(body.amount);
      const status = (body.status || "pending").trim();
      let orderCode = String(body.order_code || "").trim() || generateOrderCode();
      if (!customerId || !productId || !Number.isFinite(amount) || amount < 0) {
        return sendJson(res, 400, { error: "Dữ liệu đơn hàng không hợp lệ" });
      }

      let orderEmailContext = null;
      await mutate((snap) => {
        const product = snap.products.find((p) => p.id === productId);
        if (!product) throw new Error("Sản phẩm không tồn tại");
        if (product.stock_quantity <= 0) throw new Error("Sản phẩm đã hết hàng");
        const customer = snap.customers.find((c) => c.id === customerId);
        if (!customer) throw new Error("Khách hàng không tồn tại");

        const id = nextId(snap.orders);
        snap.orders.push({
          id,
          customer_id: customerId,
          product_id: productId,
          amount,
          status,
          order_code: orderCode,
          purchased_at: body.purchased_at || nowSqliteStyle(),
        });
        orderEmailContext = {
          customerName: customer.name || "",
          customerEmail: String(customer.email || "").trim(),
          productName: product.name || "",
        };
        product.stock_quantity -= 1;
      });
      try {
        await sendOrderCreatedConfirmation({
          customerName: orderEmailContext?.customerName,
          customerEmail: orderEmailContext?.customerEmail,
          productName: orderEmailContext?.productName,
          amount,
          orderCode,
        });
      } catch (e) {
        console.error("[email-flow] order confirmation failed", {
          message: e?.message || String(e),
          response: e?.response || null,
          orderCode,
          customerId,
          productId,
        });
      }
      return sendJson(res, 201, { ok: true, order_code: orderCode });
    }

    const orderConfirmMatch = url.pathname.match(/^\/api\/orders\/(\d+)\/confirm\/?$/);
    if (req.method === "PUT" && orderConfirmMatch) {
      const id = Number(orderConfirmMatch[1]);
      if (!id) {
        return sendJson(res, 400, { error: "ID đơn hàng không hợp lệ" });
      }
      let updated = false;
      await mutate((snap) => {
        const o = snap.orders.find((x) => sameId(x.id, id));
        if (o && o.status === "pending") {
          o.status = "success";
          updated = true;
        }
      });
      if (!updated) {
        return sendJson(res, 400, {
          error: "Không cập nhật được: đơn không tồn tại hoặc không còn trạng thái chờ thanh toán.",
        });
      }
      return sendJson(res, 200, { ok: true, order_id: id, status: "success" });
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/orders/")) {
      const id = Number(url.pathname.split("/").pop());
      const body = await readJsonBody(req);
      const customerId = Number(body.customer_id);
      const productId = Number(body.product_id);
      const amount = Number(body.amount);
      const status = (body.status || "pending").trim();
      const orderCode = String(body.order_code || "").trim();
      if (!id || !customerId || !productId || !Number.isFinite(amount) || amount < 0) {
        return sendJson(res, 400, { error: "Dữ liệu cập nhật đơn hàng không hợp lệ" });
      }
      await mutate((snap) => {
        const o = snap.orders.find((x) => x.id === id);
        if (!o) throw new Error("Don hang khong ton tai");
        o.customer_id = customerId;
        o.product_id = productId;
        o.amount = amount;
        o.status = status;
        if (orderCode) o.order_code = orderCode;
        if (body.purchased_at) o.purchased_at = body.purchased_at;
      });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/orders/")) {
      const id = Number(url.pathname.split("/").pop());
      await mutate((snap) => {
        snap.orders = snap.orders.filter((o) => o.id !== id);
      });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/payment-orders/status") {
      const code = String(url.searchParams.get("order_code") || "").trim().toUpperCase();
      if (!code) {
        return sendJson(res, 400, { error: "Thiếu order_code" });
      }
      const snapshot = await loadSnapshot(sql);
      const order = snapshot.orders.find(
        (o) => String(o.order_code || "").trim().toUpperCase() === code
      );
      if (!order) {
        return sendJson(res, 404, { error: "Không tìm thấy đơn với mã này." });
      }
      return sendJson(res, 200, {
        order_id: order.id,
        order_code: order.order_code,
        status: order.status,
        amount: order.amount,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/payment-orders") {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      const zalo = String(body.zalo || "").trim();
      const amount = Number(body.amount || 0);
      if (!name || !Number.isFinite(amount) || amount <= 0) {
        return sendJson(res, 400, { error: "Vui long nhap ten va so tien hop le." });
      }

      const orderCode = generateOrderCode();
      const orderId = await mutate((snap) => {
        const customerId = nextId(snap.customers);
        snap.customers.push({
          id: customerId,
          name,
          phone,
          email: String(body.email || "").trim(),
          zalo,
          registered_at: nowSqliteStyle(),
        });
        const productId = ensureDefaultProduct(snap);
        const id = nextId(snap.orders);
        snap.orders.push({
          id,
          customer_id: customerId,
          product_id: productId,
          amount,
          status: "pending",
          order_code: orderCode,
          purchased_at: nowSqliteStyle(),
        });
        return id;
      });
      return sendJson(res, 201, { success: true, order_id: orderId, order_code: orderCode });
    }

    if (req.method === "POST" && url.pathname === "/api/sepay-webhook") {
      const { raw, json: payload } = await readJsonBodyWithRaw(req);

      const snapshot = await loadSnapshot(sql);
      const pendingOrders = sortByIdDesc(
        snapshot.orders.filter((o) => o.status === "pending")
      ).map((o) => ({
        id: o.id,
        customer_id: o.customer_id,
        product_id: o.product_id,
        amount: o.amount,
        status: o.status,
        order_code: o.order_code,
        purchased_at: o.purchased_at,
      }));

      console.log("[SEPAY WEBHOOK] raw body:", raw);
      console.log("[SEPAY WEBHOOK] parsed payload:", payload);
      console.log("[SEPAY WEBHOOK] pending orders:", pendingOrders);

      const transferType = String(payload.transferType || "").toLowerCase();
      const transferAmount = Number(payload.transferAmount || 0);
      const memo = extractTransferMemoFromPayload(payload);

      if (transferType !== "in" || !Number.isFinite(transferAmount) || transferAmount <= 0) {
        return sendJson(res, 200, { success: true, ignored: true });
      }

      const matchedOrder = findOrderByTransfer(snapshot, memo);
      if (!matchedOrder) {
        return sendJson(res, 200, { success: true, matched: false });
      }

      await mutate((snap) => {
        const o = snap.orders.find((x) => x.id === matchedOrder.id && x.status === "pending");
        if (o) o.status = "success";
      });

      return sendJson(res, 200, { success: true, matched: true, order_id: matchedOrder.id });
    }

    return sendJson(res, 404, { error: "API not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
}

module.exports = { handleApiPostgres };
