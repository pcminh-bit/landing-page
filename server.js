const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(__dirname, ".env"));
loadEnvFile(path.join(__dirname, ".env.production"));

const { usePostgresStore } = require("./pg-store");
const { handleApiPostgres } = require("./api-postgres");
const {
  notifyWaitlistSignup,
  sendOrderCreatedConfirmation,
  sendDigitalProductDelivery,
} = require("./resend-mail");
const { getDigitalProduct } = require("./digital-products");
const {
  generateDownloadToken,
  resolveZipPath,
  buildDownloadUrl,
  paymentStatusPayload,
  streamZipDownload,
  ensureDownloadTokenSqlite,
  getOrderByCodeSqlite,
  getOrderByTokenSqlite,
  markDeliverySentSqlite,
  ensureDownloadTokenSnapshot,
  findOrderInSnapshot,
} = require("./digital-commerce");
const {
  runWaitlistSignupSequence,
  processDueJobsSqlite,
  cronEmailSequenceUnauthorized,
} = require("./email-sequence");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const SOURCE_DB_PATH = path.join(ROOT, "brain.db");
const DB_PATH = process.env.VERCEL ? "/tmp/brain.db" : SOURCE_DB_PATH;
const CURSOR_ASSETS_DIR =
  "C:/Users/ASUS/.cursor/projects/g-My-Drive-AI-Challenge-Day-2-landing-page/assets";

if (process.env.VERCEL) {
  try {
    if (!fs.existsSync(DB_PATH) && fs.existsSync(SOURCE_DB_PATH)) {
      fs.copyFileSync(SOURCE_DB_PATH, DB_PATH);
    }
  } catch (error) {
    console.error("Can not initialize writable DB on Vercel:", error.message);
  }
}

const db = new DatabaseSync(DB_PATH);

if (process.env.VERCEL && !process.env.DATABASE_URL) {
  console.warn(
    "[landing] DATABASE_URL is not set on Vercel. SQLite in /tmp will not be shared between serverless instances. Add a Neon Postgres DATABASE_URL for consistent admin + webhook data."
  );
}

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
  order_code TEXT,
  purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);
`);

function ensureColumn(tableName, columnName, columnDef) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!cols.some((col) => col.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

ensureColumn("orders", "order_code", "TEXT");
db.exec("CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code)");
ensureColumn("orders", "digital_slug", "TEXT");
ensureColumn("orders", "download_token", "TEXT");
ensureColumn("orders", "digital_delivery_sent", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("customers", "email", "TEXT");
ensureColumn(
  "customers",
  "goclaw_signal_02_notified",
  "INTEGER NOT NULL DEFAULT 0"
);

db.exec(`
CREATE TABLE IF NOT EXISTS email_sequence_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  to_name TEXT,
  step INTEGER NOT NULL,
  send_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_seq_pending ON email_sequence_jobs(send_at, sent_at);
`);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      resolve(data);
    });
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const raw = await readRawBody(req);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

async function readJsonBodyWithRaw(req) {
  const raw = await readRawBody(req);
  if (!raw.trim()) return { raw, json: {} };
  try {
    return { raw, json: JSON.parse(raw) };
  } catch {
    throw new Error("Invalid JSON payload");
  }
}


const SERVER_BUILD_ID = "2026-05-18-digital-v2";
const DIGITAL_PRODUCT_SLUG = "linkedin-easy-posting-machine";

function resolveDigitalProductPath(pageFile) {
  const base = path.join("san-pham", DIGITAL_PRODUCT_SLUG);
  const candidates = [
    path.join(ROOT, base, pageFile),
    path.join(PUBLIC_DIR, base, pageFile),
  ];
  if (pageFile === "checkout.html") {
    candidates.push(path.join(PUBLIC_DIR, base, "checkout", "index.html"));
  }
  if (pageFile === "cam-on.html") {
    candidates.push(path.join(PUBLIC_DIR, base, "cam-on", "index.html"));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function resolveDigitalProductAsset(assetRel) {
  const safe = assetRel.replace(/\.\./g, "");
  const bases = [
    path.join(ROOT, "san-pham", DIGITAL_PRODUCT_SLUG),
    path.join(PUBLIC_DIR, "san-pham", DIGITAL_PRODUCT_SLUG),
  ];
  for (const base of bases) {
    const assetPath = path.join(base, safe);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      return assetPath;
    }
  }
  return null;
}

function resolvePublicStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  if (decoded.includes("..")) return null;
  const relative = decoded.replace(/^\/+/, "");
  if (!relative) return null;
  const fullPath = path.normalize(path.join(PUBLIC_DIR, relative));
  const publicRoot = path.normalize(PUBLIC_DIR);
  if (!fullPath.startsWith(publicRoot + path.sep) && fullPath !== publicRoot) {
    return null;
  }
  return fullPath;
}

function tryServePublicStatic(res, urlPath) {
  const filePath = resolvePublicStaticPath(urlPath);
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }
  if (fs.statSync(filePath).isFile()) {
    serveStaticFile(res, filePath);
    return true;
  }
  if (fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, "index.html");
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      serveStaticFile(res, indexPath);
      return true;
    }
  }
  return false;
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
      const msg =
        err.code === "EACCES" ? "Permission denied" : "File not found";
      sendJson(res, err.code === "EACCES" ? 403 : 404, { error: msg });
      return;
    }
    const ext = path.extname(normalized).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const base = path.basename(normalized).toLowerCase();
    const adminAsset =
      base === "admin.js" || base === "admin.css" || base === "admin.html";
    const headers = { "Content-Type": contentType };
    if (adminAsset) {
      headers["Cache-Control"] = "no-store, max-age=0";
    }
    res.writeHead(200, headers);
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
    .prepare("SELECT id, name, phone, email, zalo, registered_at FROM customers ORDER BY id DESC")
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
        o.order_code,
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

/** Chỉ khớp đơn pending khi toàn bộ mã đơn (order_code) xuất hiện trong nội dung giao dịch. */
function findOrderByTransferContent(memoUpper) {
  const normalizedContent = String(memoUpper || "").toUpperCase();
  const pendingByCode = db
    .prepare(
      "SELECT id, status, amount, order_code FROM orders WHERE status = 'pending' AND order_code IS NOT NULL AND TRIM(order_code) != '' ORDER BY id DESC"
    )
    .all();
  for (const order of pendingByCode) {
    const code = String(order.order_code || "").toUpperCase().trim();
    if (code && normalizedContent.includes(code)) {
      return order;
    }
  }
  return null;
}

function generateOrderCode() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900 + 100);
  return `DH${timestamp}${random}`;
}

function ensureDefaultProductId() {
  const existing = db
    .prepare("SELECT id FROM products ORDER BY id ASC LIMIT 1")
    .get();
  if (existing) return existing.id;
  const result = db
    .prepare(
      "INSERT INTO products(name, price, description, stock_quantity) VALUES (?, ?, ?, ?)"
    )
    .run("Thanh toan hoc bong", 1000, "San pham mac dinh cho thanh toan online", 999999);
  return Number(result.lastInsertRowid);
}

function ensureCatalogProductId(catalog) {
  const name = String(catalog.name || "San pham so").trim();
  let row = db.prepare("SELECT id FROM products WHERE name = ? LIMIT 1").get(name);
  if (row) return row.id;
  const result = db
    .prepare(
      "INSERT INTO products(name, price, description, stock_quantity) VALUES (?, ?, ?, ?)"
    )
    .run(
      name,
      Number(catalog.price) || 0,
      catalog.tagline || "San pham so",
      999999
    );
  return Number(result.lastInsertRowid);
}

async function tryFulfillDigitalOrder(req, orderId) {
  const row = db
    .prepare(
      `SELECT o.id, o.digital_slug, o.download_token, o.digital_delivery_sent, o.status,
              c.name AS customer_name, c.email AS customer_email
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ? LIMIT 1`
    )
    .get(orderId);
  if (!row?.digital_slug || row.status !== "success") return;
  ensureDownloadTokenSqlite(db, orderId);
  const fresh = db
    .prepare(
      `SELECT o.id, o.digital_slug, o.download_token, o.digital_delivery_sent,
              c.name AS customer_name, c.email AS customer_email
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ? LIMIT 1`
    )
    .get(orderId);
  if (!fresh?.download_token || fresh.digital_delivery_sent) return;
  const catalog = getDigitalProduct(fresh.digital_slug);
  const downloadUrl = buildDownloadUrl(req, fresh.download_token);
  try {
    await sendDigitalProductDelivery({
      customerName: fresh.customer_name,
      customerEmail: fresh.customer_email,
      productName: catalog?.name || fresh.digital_slug,
      downloadUrl,
    });
    markDeliverySentSqlite(db, orderId);
  } catch (e) {
    console.error("[digital] delivery email failed", e?.message || e);
  }
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/cron/email-sequence") {
      const cronChk = cronEmailSequenceUnauthorized(req, url);
      if (cronChk.reason === "no_secret") {
        return sendJson(res, 503, { error: "CRON_SECRET chưa cấu hình." });
      }
      if (!cronChk.ok) {
        return sendJson(res, 401, { error: "Unauthorized" });
      }
      if (usePostgresStore) {
        return await handleApiPostgres(req, res, url, {
          sendJson,
          readJsonBody,
          readJsonBodyWithRaw,
        });
      }
      const processed = await processDueJobsSqlite(db);
      return sendJson(res, 200, { ok: true, processed });
    }

    if (req.method === "GET" && url.pathname === "/api/store-info") {
      return sendJson(res, 200, {
        buildId: SERVER_BUILD_ID,
        postgres: Boolean(process.env.DATABASE_URL),
        vercel: Boolean(process.env.VERCEL),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/digital-health") {
      const indexPath = resolveDigitalProductPath("index.html");
      let readable = false;
      if (indexPath) {
        try {
          fs.accessSync(indexPath, fs.constants.R_OK);
          readable = true;
        } catch {
          readable = false;
        }
      }
      return sendJson(res, 200, {
        buildId: SERVER_BUILD_ID,
        root: ROOT,
        uid: process.getuid?.() ?? null,
        indexPath,
        readable,
      });
    }

    const PROGRAMS_SELECT = `
      SELECT id, program_slug, folder_name, category_slug, sort_order, is_published,
        university_name, university_slug, accreditation_label, degree_badge,
        program_title, meta_line_1, meta_line_2, meta_line_3,
        price_after, price_display, price_after_text,
        cta_primary_label, cta_primary_url, brochure_url,
        created_at, updated_at
      FROM programs
    `;

    if (req.method === "GET" && url.pathname === "/api/programs") {
      const category = url.searchParams.get("category");
      const rows = category
        ? db
            .prepare(
              `${PROGRAMS_SELECT}
               WHERE is_published = 1 AND category_slug = ?
               ORDER BY category_slug ASC, sort_order ASC`
            )
            .all(category)
        : db
            .prepare(
              `${PROGRAMS_SELECT}
               WHERE is_published = 1
               ORDER BY category_slug ASC, sort_order ASC`
            )
            .all();
      return sendJson(res, 200, rows);
    }

    const programBySlugMatch = url.pathname.match(/^\/api\/programs\/([^/]+)\/?$/);
    if (req.method === "GET" && programBySlugMatch) {
      const slug = decodeURIComponent(programBySlugMatch[1]);
      const row = db
        .prepare(
          `${PROGRAMS_SELECT}
           WHERE program_slug = ? AND is_published = 1`
        )
        .get(slug);
      if (!row) {
        return sendJson(res, 404, { error: "Not found" });
      }
      return sendJson(res, 200, row);
    }

    if (usePostgresStore) {
      return await handleApiPostgres(req, res, url, {
        sendJson,
        readJsonBody,
        readJsonBodyWithRaw,
      });
    }

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
      const lead = {
        name: body.name.trim(),
        email: String(body.email || "").trim(),
        phone: body.phone || "",
        zalo: body.zalo || "",
      };
      db.prepare(
        "INSERT INTO customers(name, phone, email, zalo, registered_at) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))"
      ).run(
        lead.name,
        lead.phone,
        lead.email,
        lead.zalo,
        body.registered_at || null
      );
      const emailTasks = await Promise.allSettled([
        notifyWaitlistSignup(lead),
        runWaitlistSignupSequence(lead, { sqlite: db }),
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
      db.prepare(
        "UPDATE customers SET name = ?, phone = ?, email = ?, zalo = ?, registered_at = COALESCE(?, registered_at) WHERE id = ?"
      ).run(
        body.name.trim(),
        body.phone || "",
        String(body.email || "").trim(),
        body.zalo || "",
        body.registered_at || null,
        id
      );
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
      const orderCode = String(body.order_code || "").trim() || generateOrderCode();
      if (!customerId || !productId || !Number.isFinite(amount) || amount < 0) {
        return sendJson(res, 400, { error: "Dữ liệu đơn hàng không hợp lệ" });
      }

      let orderEmailContext = null;
      withTransaction(() => {
        const product = db
          .prepare("SELECT id, stock_quantity FROM products WHERE id = ?")
          .get(productId);
        if (!product) throw new Error("Sản phẩm không tồn tại");
        if (product.stock_quantity <= 0) throw new Error("Sản phẩm đã hết hàng");
        const customer = db
          .prepare("SELECT id, name, email FROM customers WHERE id = ?")
          .get(customerId);
        if (!customer) throw new Error("Khách hàng không tồn tại");
        const productInfo = db
          .prepare("SELECT id, name FROM products WHERE id = ?")
          .get(productId);
        orderEmailContext = {
          customerName: customer.name || "",
          customerEmail: String(customer.email || "").trim(),
          productName: productInfo?.name || "",
        };

        db.prepare(
          "INSERT INTO orders(customer_id, product_id, amount, status, order_code, purchased_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))"
        ).run(customerId, productId, amount, status, orderCode, body.purchased_at || null);

        db.prepare("UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = ?").run(productId);
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
      const info = db
        .prepare("UPDATE orders SET status = 'success' WHERE id = ? AND status = 'pending'")
        .run(id);
      if (!info.changes) {
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
      db.prepare(
        "UPDATE orders SET customer_id = ?, product_id = ?, amount = ?, status = ?, order_code = COALESCE(NULLIF(?, ''), order_code), purchased_at = COALESCE(?, purchased_at) WHERE id = ?"
      ).run(customerId, productId, amount, status, orderCode, body.purchased_at || null, id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/orders/")) {
      const id = Number(url.pathname.split("/").pop());
      db.prepare("DELETE FROM orders WHERE id = ?").run(id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/payment-orders/status") {
      const code = String(url.searchParams.get("order_code") || "").trim().toUpperCase();
      if (!code) {
        return sendJson(res, 400, { error: "Thiếu order_code" });
      }
      let row = getOrderByCodeSqlite(db, code);
      if (!row) {
        return sendJson(res, 404, { error: "Không tìm thấy đơn với mã này." });
      }
      if (row.digital_slug && row.status === "success") {
        ensureDownloadTokenSqlite(db, row.id);
        await tryFulfillDigitalOrder(req, row.id);
        row = getOrderByCodeSqlite(db, code);
        return sendJson(
          res,
          200,
          paymentStatusPayload(req, row, getDigitalProduct(row.digital_slug))
        );
      }
      return sendJson(res, 200, {
        order_id: row.id,
        order_code: row.order_code,
        status: row.status,
        amount: row.amount,
      });
    }

    const digitalProductMatch = url.pathname.match(
      /^\/api\/digital-products\/([a-z0-9-]+)\/?$/
    );
    if (req.method === "GET" && digitalProductMatch) {
      const catalog = getDigitalProduct(digitalProductMatch[1]);
      if (!catalog) {
        return sendJson(res, 404, { error: "Không tìm thấy sản phẩm." });
      }
      return sendJson(res, 200, {
        slug: catalog.slug,
        name: catalog.name,
        tagline: catalog.tagline,
        price: catalog.price,
        paths: catalog.paths,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/digital-payment-orders") {
      const body = await readJsonBody(req);
      const slug = String(body.slug || "").trim();
      const catalog = getDigitalProduct(slug);
      if (!catalog) {
        return sendJson(res, 400, { error: "Sản phẩm không hợp lệ." });
      }
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim();
      const phone = String(body.phone || "").trim();
      const zalo = String(body.zalo || "").trim();
      if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return sendJson(res, 400, { error: "Vui lòng nhập họ tên và email hợp lệ." });
      }

      const orderCode = generateOrderCode();
      const amount = Number(catalog.price);
      const result = withTransaction(() => {
        const customerInsert = db
          .prepare(
            "INSERT INTO customers(name, phone, email, zalo, registered_at) VALUES (?, ?, ?, ?, datetime('now'))"
          )
          .run(name, phone, email, zalo);
        const customerId = Number(customerInsert.lastInsertRowid);
        const productId = ensureCatalogProductId(catalog);
        const orderInsert = db
          .prepare(
            `INSERT INTO orders(customer_id, product_id, amount, status, order_code, purchased_at, digital_slug)
             VALUES (?, ?, ?, 'pending', ?, datetime('now'), ?)`
          )
          .run(customerId, productId, amount, orderCode, slug);
        return Number(orderInsert.lastInsertRowid);
      });

      return sendJson(res, 201, {
        success: true,
        order_id: result,
        order_code: orderCode,
        amount,
        product_slug: slug,
        checkout_url: `${catalog.paths.checkout}?order_code=${encodeURIComponent(orderCode)}`,
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
      const result = withTransaction(() => {
        const customerInsert = db
          .prepare(
            "INSERT INTO customers(name, phone, email, zalo, registered_at) VALUES (?, ?, ?, ?, datetime('now'))"
          )
          .run(name, phone, String(body.email || "").trim(), zalo);
        const customerId = Number(customerInsert.lastInsertRowid);
        const productId = ensureDefaultProductId();

        const orderInsert = db
          .prepare(
            "INSERT INTO orders(customer_id, product_id, amount, status, order_code, purchased_at) VALUES (?, ?, ?, 'pending', ?, datetime('now'))"
          )
          .run(customerId, productId, amount, orderCode);

        return Number(orderInsert.lastInsertRowid);
      });

      return sendJson(res, 201, { success: true, order_id: result, order_code: orderCode });
    }

    if (req.method === "POST" && url.pathname === "/api/sepay-webhook") {
      const { raw, json: payload } = await readJsonBodyWithRaw(req);
      void raw;

      const pendingOrders = db
        .prepare(
          "SELECT id, customer_id, product_id, amount, status, order_code, purchased_at FROM orders WHERE status = 'pending' ORDER BY id DESC"
        )
        .all();
      console.log("[SEPAY WEBHOOK] raw body:", raw);
      console.log("[SEPAY WEBHOOK] parsed payload:", payload);
      console.log("[SEPAY WEBHOOK] pending orders:", pendingOrders);

      const transferType = String(payload.transferType || "").toLowerCase();
      const transferAmount = Number(payload.transferAmount || 0);
      const memo = extractTransferMemoFromPayload(payload);

      if (transferType !== "in" || !Number.isFinite(transferAmount) || transferAmount <= 0) {
        return sendJson(res, 200, { success: true, ignored: true });
      }

      const matchedOrder = findOrderByTransferContent(memo);
      if (!matchedOrder) {
        return sendJson(res, 200, { success: true, matched: false });
      }

      db.prepare(
        "UPDATE orders SET status = 'success' WHERE id = ? AND status = 'pending'"
      ).run(matchedOrder.id);

      const digitalRow = db
        .prepare("SELECT digital_slug FROM orders WHERE id = ? LIMIT 1")
        .get(matchedOrder.id);
      if (digitalRow?.digital_slug) {
        ensureDownloadTokenSqlite(db, matchedOrder.id);
        await tryFulfillDigitalOrder(req, matchedOrder.id);
      }

      return sendJson(res, 200, { success: true, matched: true, order_id: matchedOrder.id });
    }

    const digitalDownloadMatch = url.pathname.match(
      /^\/api\/digital-download\/([A-Za-z0-9]+)\/?$/
    );
    if (req.method === "GET" && digitalDownloadMatch) {
      const token = digitalDownloadMatch[1];
      const row = getOrderByTokenSqlite(db, token);
      if (!row?.digital_slug) {
        return sendJson(res, 403, { error: "Link không hợp lệ hoặc chưa thanh toán." });
      }
      const catalog = getDigitalProduct(row.digital_slug);
      const zipPath = resolveZipPath(catalog);
      if (!zipPath) {
        return sendJson(res, 503, { error: "File sản phẩm chưa sẵn sàng trên server." });
      }
      return streamZipDownload(res, zipPath, catalog.zipFile);
    }

    return sendJson(res, 404, { error: "API not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
}

function parseRequestUrl(req) {
  const host = req.headers.host && String(req.headers.host).trim();
  const port = Number(process.env.PORT) || 3000;
  const base = host ? `http://${host}` : `http://127.0.0.1:${port}`;
  const pathPart = req.url && String(req.url).trim() ? req.url : "/";
  return new URL(pathPart, base);
}

async function handleRequest(req, res) {
  const url = parseRequestUrl(req);

  if (url.pathname.startsWith("/api/")) {
    return await handleApi(req, res, url);
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

  const digitalPageMap = {
    "/san-pham/linkedin-easy-posting-machine": "index.html",
    "/san-pham/linkedin-easy-posting-machine/": "index.html",
    "/san-pham/linkedin-easy-posting-machine/checkout": "checkout.html",
    "/san-pham/linkedin-easy-posting-machine/checkout/": "checkout.html",
    "/san-pham/linkedin-easy-posting-machine/cam-on": "cam-on.html",
    "/san-pham/linkedin-easy-posting-machine/cam-on/": "cam-on.html",
  };
  const digitalPage = digitalPageMap[url.pathname];
  if (digitalPage) {
    const resolved = resolveDigitalProductPath(digitalPage);
    if (resolved) {
      return serveStaticFile(res, resolved);
    }
    console.error(
      "[digital] missing file",
      digitalPage,
      "ROOT=",
      ROOT,
      "uid=",
      process.getuid?.()
    );
    return sendJson(res, 404, { error: "File not found" });
  }
  if (url.pathname.startsWith("/san-pham/linkedin-easy-posting-machine/")) {
    const assetRel = url.pathname.replace(
      "/san-pham/linkedin-easy-posting-machine/",
      ""
    );
    const assetPath = resolveDigitalProductAsset(assetRel);
    if (assetPath) {
      return serveStaticFile(res, assetPath);
    }
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return serveStaticFile(res, path.join(PUBLIC_DIR, "index.html"));
  }

  if (
    url.pathname === "/chuong-trinh" ||
    url.pathname === "/chuong-trinh.html"
  ) {
    res.writeHead(302, { Location: "/#chuong-trinh" });
    res.end();
    return;
  }

  if (tryServePublicStatic(res, url.pathname)) {
    return;
  }

  return sendJson(res, 404, { error: "Not found" });
}

module.exports = handleRequest;

if (!process.env.VERCEL) {
  const server = http.createServer((req, res) => {
    Promise.resolve(handleRequest(req, res)).catch((err) => {
      console.error(err);
      if (res.headersSent) return;
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message || "Internal server error" }));
    });
  });

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
  });
}
