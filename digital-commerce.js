const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { getDigitalProduct } = require("./digital-products");
const { nextId, nowSqliteStyle } = require("./pg-store");

const ROOT = __dirname;
const ZIP_DIRS = [
  path.join(ROOT, "dist"),
  path.join(ROOT, "public", "downloads"),
];

function generateDownloadToken() {
  return `DL${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

function resolveZipPath(product) {
  if (!product?.zipFile) return null;
  for (const dir of ZIP_DIRS) {
    const p = path.join(dir, product.zipFile);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function siteOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "www.hocbong-upgrad.com";
  return `${proto}://${host}`.replace(/\/$/, "");
}

function buildDownloadUrl(req, token) {
  return `${siteOrigin(req)}/api/digital-download/${encodeURIComponent(token)}`;
}

function buildThanksUrl(req, slug, orderCode) {
  const p = getDigitalProduct(slug);
  const base = p?.paths?.thanks || `/san-pham/${slug}/cam-on`;
  return `${siteOrigin(req)}${base}?order_code=${encodeURIComponent(orderCode)}`;
}

function paymentStatusPayload(req, order, product) {
  const base = {
    order_id: order.id,
    order_code: order.order_code,
    status: order.status,
    amount: order.amount,
  };
  if (!order.digital_slug) return base;
  const catalog = getDigitalProduct(order.digital_slug) || product;
  base.digital = true;
  base.product_name = catalog?.name || order.digital_slug;
  base.product_slug = order.digital_slug;
  if (order.status === "success" && order.download_token) {
    base.download_token = order.download_token;
    base.download_url = buildDownloadUrl(req, order.download_token);
    base.thanks_url = buildThanksUrl(req, order.digital_slug, order.order_code);
  }
  return base;
}

function streamZipDownload(res, filePath, downloadName) {
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Length": stat.size,
    "Content-Disposition": `attachment; filename="${downloadName}"`,
    "Cache-Control": "private, no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function ensureDownloadTokenSqlite(db, orderId) {
  const row = db
    .prepare(
      "SELECT id, digital_slug, download_token, status FROM orders WHERE id = ? LIMIT 1"
    )
    .get(orderId);
  if (!row?.digital_slug || row.status !== "success") return row;
  if (row.download_token) return row;
  const token = generateDownloadToken();
  db.prepare("UPDATE orders SET download_token = ? WHERE id = ?").run(token, orderId);
  return { ...row, download_token: token };
}

function getOrderByCodeSqlite(db, code) {
  return db
    .prepare(
      `SELECT o.id, o.status, o.order_code, o.amount, o.digital_slug, o.download_token, o.digital_delivery_sent,
              c.name AS customer_name, c.email AS customer_email
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE UPPER(TRIM(o.order_code)) = ?
       LIMIT 1`
    )
    .get(String(code || "").trim().toUpperCase());
}

function getOrderByTokenSqlite(db, token) {
  return db
    .prepare(
      `SELECT o.id, o.status, o.digital_slug, o.download_token
       FROM orders o
       WHERE o.download_token = ? AND o.status = 'success'
       LIMIT 1`
    )
    .get(String(token || "").trim());
}

function markDeliverySentSqlite(db, orderId) {
  db.prepare("UPDATE orders SET digital_delivery_sent = 1 WHERE id = ?").run(orderId);
}

function findOrderInSnapshot(snapshot, orderId) {
  const order = snapshot.orders.find((o) => Number(o.id) === Number(orderId));
  if (!order) return null;
  const customer = snapshot.customers.find((c) => Number(c.id) === Number(order.customer_id));
  return { order, customer };
}

function ensureDownloadTokenSnapshot(snapshot, orderId) {
  const found = findOrderInSnapshot(snapshot, orderId);
  if (!found) return null;
  const { order } = found;
  if (!order.digital_slug || order.status !== "success") return found;
  if (!order.download_token) {
    order.download_token = generateDownloadToken();
  }
  return found;
}

function getOrderByCodeSnapshot(snapshot, code) {
  const normalized = String(code || "").trim().toUpperCase();
  const order = snapshot.orders.find(
    (o) => String(o.order_code || "").trim().toUpperCase() === normalized
  );
  if (!order) return null;
  const customer = snapshot.customers.find((c) => Number(c.id) === Number(order.customer_id));
  return {
    id: order.id,
    status: order.status,
    order_code: order.order_code,
    amount: order.amount,
    digital_slug: order.digital_slug || null,
    download_token: order.download_token || null,
    digital_delivery_sent: order.digital_delivery_sent || 0,
    customer_name: customer?.name || "",
    customer_email: customer?.email || "",
  };
}

function getOrderByTokenSnapshot(snapshot, token) {
  const t = String(token || "").trim();
  const order = snapshot.orders.find(
    (o) => o.download_token === t && o.status === "success"
  );
  if (!order) return null;
  return {
    id: order.id,
    status: order.status,
    digital_slug: order.digital_slug,
    download_token: order.download_token,
  };
}

function ensureCatalogProductSnapshot(snapshot, catalog) {
  const name = String(catalog.name || "").trim();
  let product = snapshot.products.find((p) => p.name === name);
  if (!product) {
    const id = nextId(snapshot.products);
    product = {
      id,
      name,
      price: Number(catalog.price) || 0,
      description: catalog.tagline || "",
      stock_quantity: 999999,
      created_at: nowSqliteStyle(),
    };
    snapshot.products.push(product);
  }
  return product.id;
}

module.exports = {
  ZIP_DIRS,
  generateDownloadToken,
  resolveZipPath,
  siteOrigin,
  buildDownloadUrl,
  buildThanksUrl,
  paymentStatusPayload,
  streamZipDownload,
  ensureDownloadTokenSqlite,
  getOrderByCodeSqlite,
  getOrderByTokenSqlite,
  markDeliverySentSqlite,
  findOrderInSnapshot,
  ensureDownloadTokenSnapshot,
  getOrderByCodeSnapshot,
  getOrderByTokenSnapshot,
  ensureCatalogProductSnapshot,
};
