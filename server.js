const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
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
  purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);
`);

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

function verifySepaySignature(rawBody, signatureHeader) {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signatureHeader) return false;

  const provided = String(signatureHeader).trim().replace(/^sha256=/i, "").toLowerCase();
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
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

function findOrderByTransferContent(content, transferAmount) {
  const normalizedContent = String(content || "").toUpperCase();
  const fallback = normalizedContent.match(/DH(\d{1,8})/);
  if (fallback) {
    const orderId = Number(fallback[1]);
    if (orderId) {
      return db
        .prepare("SELECT id, status, amount FROM orders WHERE id = ? AND status = 'pending'")
        .get(orderId);
    }
  }

  if (Number.isFinite(transferAmount) && transferAmount > 0) {
    return db
      .prepare(
        "SELECT id, status, amount FROM orders WHERE status = 'pending' AND CAST(amount AS INTEGER) = CAST(? AS INTEGER) ORDER BY id DESC LIMIT 1"
      )
      .get(transferAmount);
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
      if (!customerId || !productId || !Number.isFinite(amount) || amount < 0) {
        return sendJson(res, 400, { error: "Dữ liệu đơn hàng không hợp lệ" });
      }

      withTransaction(() => {
        const product = db
          .prepare("SELECT id, stock_quantity FROM products WHERE id = ?")
          .get(productId);
        if (!product) throw new Error("Sản phẩm không tồn tại");
        if (product.stock_quantity <= 0) throw new Error("Sản phẩm đã hết hàng");

        db.prepare(
          "INSERT INTO orders(customer_id, product_id, amount, status, purchased_at) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))"
        ).run(customerId, productId, amount, status, body.purchased_at || null);

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
      if (!id || !customerId || !productId || !Number.isFinite(amount) || amount < 0) {
        return sendJson(res, 400, { error: "Dữ liệu cập nhật đơn hàng không hợp lệ" });
      }
      db.prepare(
        "UPDATE orders SET customer_id = ?, product_id = ?, amount = ?, status = ?, purchased_at = COALESCE(?, purchased_at) WHERE id = ?"
      ).run(customerId, productId, amount, status, body.purchased_at || null, id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/orders/")) {
      const id = Number(url.pathname.split("/").pop());
      db.prepare("DELETE FROM orders WHERE id = ?").run(id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/sepay-webhook") {
      const { raw, json: payload } = await readJsonBodyWithRaw(req);
      const signatureHeader = req.headers["x-sepay-signature"];
      const isValidSignature = verifySepaySignature(raw, signatureHeader);
      if (!isValidSignature) {
        return sendJson(res, 401, { success: false, error: "Invalid webhook signature" });
      }

      const transferType = String(payload.transferType || "").toLowerCase();
      const transferAmount = Number(payload.transferAmount || 0);
      const content = String(payload.content || payload.description || "");

      if (transferType !== "in" || !Number.isFinite(transferAmount) || transferAmount <= 0) {
        return sendJson(res, 200, { success: true, ignored: true });
      }

      const matchedOrder = findOrderByTransferContent(content, transferAmount);
      if (!matchedOrder) {
        return sendJson(res, 200, { success: true, matched: false });
      }

      db.prepare(
        "UPDATE orders SET status = 'success' WHERE id = ? AND status = 'pending'"
      ).run(matchedOrder.id);

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
