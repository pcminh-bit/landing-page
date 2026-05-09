const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = path.join(ROOT, "brain.db");
const CURSOR_ASSETS_DIR =
  "C:/Users/ASUS/.cursor/projects/g-My-Drive-AI-Challenge-Day-2-landing-page/assets";
const db = new DatabaseSync(DB_PATH);

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL CHECK(price >= 0),
  description TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  zalo TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending',
  payment_code TEXT,
  sepay_transaction_id INTEGER UNIQUE,
  sepay_reference_code TEXT,
  paid_at TEXT,
  purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);
`);

function ensureColumn(tableName, columnName, columnDef) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

ensureColumn("orders", "payment_code", "TEXT");
ensureColumn("orders", "sepay_transaction_id", "INTEGER");
ensureColumn("orders", "sepay_reference_code", "TEXT");
ensureColumn("orders", "paid_at", "TEXT");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_sepay_transaction_id ON orders(sepay_transaction_id)");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function serveStaticFile(res, filePath) {
  const normalized = path.normalize(filePath);
  const isInProject = normalized.startsWith(path.normalize(ROOT));
  const isInCursorAssets = normalized.startsWith(path.normalize(CURSOR_ASSETS_DIR));
  const isInPublic = normalized.startsWith(path.normalize(PUBLIC_DIR));
  if (!isInProject && !isInCursorAssets && !isInPublic) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(normalized, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }
    const ext = path.extname(normalized).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function getAllProducts() {
  return db
    .prepare("SELECT id, name, price, description, stock_quantity, created_at FROM products ORDER BY id DESC")
    .all();
}

function getAllCustomers() {
  return db
    .prepare("SELECT id, name, phone, zalo, registered_at FROM customers ORDER BY id DESC")
    .all();
}

function getAllOrders() {
  return db
    .prepare(
      `SELECT
        o.id,
        o.customer_id,
        o.product_id,
        o.amount,
        o.status,
        o.payment_code,
        o.sepay_transaction_id,
        o.sepay_reference_code,
        o.paid_at,
        o.purchased_at,
        c.name AS customer_name,
        p.name AS product_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN products p ON p.id = o.product_id
      ORDER BY o.id DESC`
    )
    .all();
}

function withTransaction(work) {
  db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function findOrderByTransferContent(content, code) {
  const normalizedContent = String(content || "").toUpperCase();
  const normalizedCode = String(code || "").toUpperCase();
  const pendingOrders = db
    .prepare(
      "SELECT id, payment_code, status FROM orders WHERE status = 'pending' ORDER BY id DESC"
    )
    .all();

  for (const order of pendingOrders) {
    const paymentCode = String(order.payment_code || "").toUpperCase().trim();
    if (!paymentCode) continue;
    if (normalizedContent.includes(paymentCode) || normalizedCode === paymentCode) {
      return order;
    }
  }

  const fallback = normalizedContent.match(/DH(\d{1,8})/);
  if (fallback) {
    const orderId = Number(fallback[1]);
    if (orderId) {
      return db
        .prepare("SELECT id, payment_code, status FROM orders WHERE id = ? AND status = 'pending'")
        .get(orderId);
    }
  }
  return null;
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/products") {
      return sendJson(res, 200, getAllProducts());
    }
    if (req.method === "GET" && url.pathname === "/api/customers") {
      return sendJson(res, 200, getAllCustomers());
    }
    if (req.method === "GET" && url.pathname === "/api/orders") {
      return sendJson(res, 200, getAllOrders());
    }

    if (req.method === "POST" && url.pathname === "/api/products") {
      const body = await readJsonBody(req);
      if (!body.name || body.price === undefined) {
        return sendJson(res, 400, { error: "name và price là bắt buộc" });
      }
      const stock = Number(body.stock_quantity || 0);
      const price = Number(body.price);
      if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(price) || price < 0) {
        return sendJson(res, 400, { error: "price/stock_quantity không hợp lệ" });
      }
      db.prepare(
        "INSERT INTO products(name, price, description, stock_quantity) VALUES (?, ?, ?, ?)"
      ).run(body.name.trim(), price, body.description || "", stock);
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
      db.prepare(
        "UPDATE products SET name = ?, price = ?, description = ?, stock_quantity = ? WHERE id = ?"
      ).run(body.name.trim(), price, body.description || "", stock, id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/products/")) {
      const id = Number(url.pathname.split("/").pop());
      db.prepare("DELETE FROM products WHERE id = ?").run(id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/customers") {
      const body = await readJsonBody(req);
      if (!body.name) {
        return sendJson(res, 400, { error: "name là bắt buộc" });
      }
      db.prepare(
        "INSERT INTO customers(name, phone, zalo, registered_at) VALUES (?, ?, ?, COALESCE(?, datetime('now')))"
      ).run(body.name.trim(), body.phone || "", body.zalo || "", body.registered_at || null);
      return sendJson(res, 201, { ok: true });
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/customers/")) {
      const id = Number(url.pathname.split("/").pop());
      const body = await readJsonBody(req);
      if (!id || !body.name) {
        return sendJson(res, 400, { error: "Dữ liệu cập nhật không hợp lệ" });
      }
      db.prepare(
        "UPDATE customers SET name = ?, phone = ?, zalo = ?, registered_at = COALESCE(?, registered_at) WHERE id = ?"
      ).run(body.name.trim(), body.phone || "", body.zalo || "", body.registered_at || null, id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/customers/")) {
      const id = Number(url.pathname.split("/").pop());
      const linked = db.prepare("SELECT COUNT(*) AS total FROM orders WHERE customer_id = ?").get(id);
      if (linked.total > 0) {
        return sendJson(res, 400, { error: "Khách hàng này đã có đơn hàng, không thể xóa." });
      }
      db.prepare("DELETE FROM customers WHERE id = ?").run(id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/orders") {
      const body = await readJsonBody(req);
      const customerId = Number(body.customer_id);
      const productId = Number(body.product_id);
      const amount = Number(body.amount);
      const status = (body.status || "pending").trim();
      const paymentCodeRaw = String(body.payment_code || "").trim();
      if (!customerId || !productId || !Number.isFinite(amount) || amount < 0) {
        return sendJson(res, 400, { error: "Dữ liệu đơn hàng không hợp lệ" });
      }

      withTransaction(() => {
        const product = db
          .prepare("SELECT id, stock_quantity FROM products WHERE id = ?")
          .get(productId);
        if (!product) throw new Error("Sản phẩm không tồn tại");
        if (product.stock_quantity <= 0) throw new Error("Sản phẩm đã hết hàng");

        const insertResult = db.prepare(
          "INSERT INTO orders(customer_id, product_id, amount, status, purchased_at) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))"
        ).run(customerId, productId, amount, status, body.purchased_at || null);

        const insertedId = Number(insertResult.lastInsertRowid);
        const paymentCode = paymentCodeRaw || `DH${String(insertedId).padStart(3, "0")}`;
        db.prepare("UPDATE orders SET payment_code = ? WHERE id = ?").run(paymentCode, insertedId);

        db.prepare("UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = ?").run(productId);
      });

      return sendJson(res, 201, { ok: true });
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/orders/")) {
      const id = Number(url.pathname.split("/").pop());
      const body = await readJsonBody(req);
      const customerId = Number(body.customer_id);
      const productId = Number(body.product_id);
      const amount = Number(body.amount);
      const status = (body.status || "pending").trim();
      const paymentCode = String(body.payment_code || "").trim();
      if (!id || !customerId || !productId || !Number.isFinite(amount) || amount < 0) {
        return sendJson(res, 400, { error: "Dữ liệu cập nhật đơn hàng không hợp lệ" });
      }
      db.prepare(
        "UPDATE orders SET customer_id = ?, product_id = ?, amount = ?, status = ?, payment_code = COALESCE(NULLIF(?, ''), payment_code), purchased_at = COALESCE(?, purchased_at) WHERE id = ?"
      ).run(customerId, productId, amount, status, paymentCode, body.purchased_at || null, id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/orders/")) {
      const id = Number(url.pathname.split("/").pop());
      db.prepare("DELETE FROM orders WHERE id = ?").run(id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/sepay-webhook") {
      const payload = await readJsonBody(req);
      const transferType = String(payload.transferType || "").toLowerCase();
      const transferAmount = Number(payload.transferAmount || 0);
      const content = String(payload.content || payload.description || "");
      const code = String(payload.code || "");
      const transactionId = Number(payload.id || 0);
      const referenceCode = String(payload.referenceCode || "");

      if (transferType !== "in" || !Number.isFinite(transferAmount) || transferAmount <= 0) {
        return sendJson(res, 200, { success: true, ignored: true });
      }

      if (transactionId) {
        const existed = db
          .prepare("SELECT id FROM orders WHERE sepay_transaction_id = ? LIMIT 1")
          .get(transactionId);
        if (existed) {
          return sendJson(res, 200, { success: true, duplicate: true, order_id: existed.id });
        }
      }

      const matchedOrder = findOrderByTransferContent(content, code);
      if (!matchedOrder) {
        return sendJson(res, 200, { success: true, matched: false });
      }

      db.prepare(
        "UPDATE orders SET status = 'success', sepay_transaction_id = COALESCE(?, sepay_transaction_id), sepay_reference_code = COALESCE(NULLIF(?, ''), sepay_reference_code), paid_at = COALESCE(?, datetime('now')) WHERE id = ? AND status = 'pending'"
      ).run(transactionId || null, referenceCode, payload.transactionDate || null, matchedOrder.id);

      return sendJson(res, 200, { success: true, matched: true, order_id: matchedOrder.id });
    }

    return sendJson(res, 404, { error: "API not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url);
  }

  if (url.pathname.startsWith("/_cursor_assets/")) {
    const relativePath = decodeURIComponent(
      url.pathname.replace("/_cursor_assets/", "")
    );
    return serveStaticFile(res, path.join(CURSOR_ASSETS_DIR, relativePath));
  }

  if (url.pathname === "/admin") {
    return serveStaticFile(res, path.join(ROOT, "admin.html"));
  }

  if (url.pathname === "/payment") {
    return serveStaticFile(res, path.join(ROOT, "payment.html"));
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return serveStaticFile(res, path.join(ROOT, "index.html"));
  }

  const requested = url.pathname.replace(/^\/+/, "");
  if (!requested) {
    return serveStaticFile(res, path.join(ROOT, "index.html"));
  }

  const rootPath = path.join(ROOT, requested);
  if (fs.existsSync(rootPath)) {
    return serveStaticFile(res, rootPath);
  }
  return serveStaticFile(res, path.join(PUBLIC_DIR, requested));
}

module.exports = handleRequest;

if (!process.env.VERCEL) {
  const server = http.createServer((req, res) => {
    handleRequest(req, res);
  });

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
  });
}
