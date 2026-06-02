const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const crypto = require("node:crypto");
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
  sendResendEmail,
  loadResendApiKey,
  loadResendFromEmail,
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
const DB_PATH = path.join(ROOT, "brain.db");
const CURSOR_ASSETS_DIR =
  "C:/Users/ASUS/.cursor/projects/g-My-Drive-AI-Challenge-Day-2-landing-page/assets";

const db = new DatabaseSync(DB_PATH);

const SESSION_SECRET = String(process.env.SESSION_SECRET || "").trim();
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required. Please set SESSION_SECRET in environment.");
}

const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "");
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const SESSION_COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const sessions = new Map();
const loginAttemptsByIp = new Map();
const publicFormStore = {};
const apiStore = {};

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

try {
  db.exec("ALTER TABLE referees ADD COLUMN fee_waiver INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE referees ADD COLUMN financial_plan TEXT DEFAULT 'full'");
} catch (e) {}
try {
  db.exec("ALTER TABLE referees ADD COLUMN installments TEXT");
} catch (e) {}

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
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  const cookieHeader = String(req.headers.cookie || "");
  const pairs = cookieHeader.split(";").map((part) => part.trim()).filter(Boolean);
  const cookies = {};
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = decodeURIComponent(pair.slice(0, idx).trim());
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
    cookies[key] = value;
  }
  return cookies;
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").trim();
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return String(req.socket?.remoteAddress || "").trim() || "unknown";
}

function getIpFromRequest(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress
  );
}

function rateLimit(store, key, maxRequests, windowMs) {
  const now = Date.now();
  const safeKey = String(key || "unknown");
  if (!store[safeKey] || now > store[safeKey].resetAt) {
    store[safeKey] = { count: 0, resetAt: now + windowMs };
  }
  store[safeKey].count += 1;
  if (store[safeKey].count > maxRequests) {
    return false;
  }
  return true;
}

function clearExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (!session || session.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
}

function createSession(username) {
  clearExpiredSessions();
  const now = Date.now();
  const sessionId = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${crypto.randomUUID()}-${now}`)
    .digest("hex");
  const session = {
    id: sessionId,
    username,
    expiresAt: now + SESSION_MAX_AGE_MS,
  };
  sessions.set(sessionId, session);
  return session;
}

function setSessionCookie(res, sessionId) {
  const maxAgeSeconds = Math.floor(SESSION_MAX_AGE_MS / 1000);
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(
      sessionId
    )}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  );
}

function getValidSession(req) {
  clearExpiredSessions();
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

function requireAuth(req, res) {
  const session = getValidSession(req);
  if (!session) {
    res.writeHead(302, { Location: "/login" });
    res.end();
    return false;
  }
  return true;
}

function shouldProtectApiRoute(req, pathname) {
  if (pathname.startsWith("/api/auth/")) return false;
  if (req.method === "POST" && pathname === "/api/customers") return false;
  if (req.method === "POST" && pathname === "/api/referrers") return false;
  if (req.method === "GET" && pathname === "/api/programs") return false;
  if (/^\/api\/programs\/[^/]+\/?$/.test(pathname) && req.method === "GET") return false;

  if (pathname.startsWith("/api/referrers")) return true;
  if (pathname.startsWith("/api/referees")) return true;
  if (pathname.startsWith("/api/orders")) return true;
  if (pathname.startsWith("/api/customers") && req.method === "GET") return true;
  return false;
}

function tooManyFailedLoginAttempts(ip) {
  const now = Date.now();
  const attempts = (loginAttemptsByIp.get(ip) || []).filter(
    (timestamp) => now - timestamp <= LOGIN_WINDOW_MS
  );
  loginAttemptsByIp.set(ip, attempts);
  return attempts.length >= LOGIN_MAX_FAILED_ATTEMPTS;
}

function recordFailedLoginAttempt(ip) {
  const now = Date.now();
  const attempts = (loginAttemptsByIp.get(ip) || []).filter(
    (timestamp) => now - timestamp <= LOGIN_WINDOW_MS
  );
  attempts.push(now);
  loginAttemptsByIp.set(ip, attempts);
}

function clearFailedLoginAttempts(ip) {
  loginAttemptsByIp.delete(ip);
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


const SERVER_BUILD_ID = "2026-05-29-main";
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

const emailFooter = `
<div style="background:#1f2937;padding:20px 28px;">
  <div style="display:flex;gap:16px;align-items:flex-start;">
    <div style="width:40px;height:40px;border-radius:50%;background:#E50913;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:600;flex-shrink:0;">MP</div>
    <div style="font-size:12px;color:#d1d5db;line-height:1.8;">
      <div style="font-size:11px;color:#9ca3af;">Đại diện upGrad hỗ trợ</div>
      <strong style="color:white;font-size:13px;">Minh Phạm</strong><br>
      <span style="font-size:11px;color:#9ca3af;">Regional Manager — Quan hệ Đối tác và Doanh nghiệp</span><br>
      📱 <a href="tel:0898461363" style="color:#93c5fd;text-decoration:none;">0898 461 363</a>
      &nbsp;|&nbsp;
      ✉️ <a href="mailto:minh.pham@upgrad.com" style="color:#93c5fd;text-decoration:none;">minh.pham@upgrad.com</a>
      &nbsp;|&nbsp;
      <a href="https://www.linkedin.com/in/minhphamc/" style="color:#93c5fd;text-decoration:none;">linkedin.com/in/minhphamc</a>
    </div>
  </div>
  <hr style="border:none;border-top:1px solid #374151;margin:14px 0;">
  <p style="font-size:11px;color:#6b7280;text-align:center;margin:0;">© 2026 hocbong-upgrad.com</p>
</div>
`;

const REFERRAL_MAIL_FROM =
  "Trần Tuấn Anh — Đại lý Tuyển sinh Chiến lược - upGrad Việt Nam <tuananh@hocbong-upgrad.com>";

function resolveReferralMailFrom() {
  const configured = String(loadResendFromEmail() || "").trim();
  if (!configured) return REFERRAL_MAIL_FROM;
  if (configured.includes("<")) return configured;
  return `Trần Tuấn Anh — Đại lý Tuyển sinh Chiến lược - upGrad Việt Nam <${configured}>`;
}

async function sendReferrerWelcomeEmail(referrer) {
  try {
    if (!referrer.email) return;
    const apiKey = loadResendApiKey();
    if (!apiKey) return;
    await sendResendEmail(apiKey, {
      from: resolveReferralMailFrom(),
      to: referrer.email,
      subject: `Mã giới thiệu của bạn: ${referrer.referral_code}`,
      html: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#404040;">
  <div style="background:#E50913;padding:20px 28px;">
    <h1 style="color:white;margin:0;font-size:20px;font-weight:600;">Chào mừng bạn tham gia Chương trình Giới thiệu học viên — nhận liền bonus!</h1>
  </div>
  <div style="padding:24px 28px;background:white;">
    <p style="margin:0 0 12px;line-height:1.6;">Xin chào <strong>${referrer.name}</strong>,</p>
    <p style="margin:0 0 12px;line-height:1.6;">Cảm ơn bạn đã đăng ký tham gia chương trình giới thiệu học viên của upGrad Việt Nam.</p>

    <div style="background:#f8f9fa;border-left:4px solid #E50913;padding:16px 20px;margin:16px 0;">
      <p style="margin:0 0 6px;font-size:11px;color:#6b7280;letter-spacing:0.5px;text-transform:uppercase;">Mã giới thiệu của bạn</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:#E50913;letter-spacing:2px;">${referrer.referral_code}</p>
    </div>

    <p style="margin:0 0 8px;line-height:1.6;"><strong>Cách thức hoạt động:</strong></p>
    <ol style="padding-left:20px;margin:0 0 16px;">
      <li style="line-height:2;font-size:14px;">Giới thiệu người quen quan tâm đến các chương trình Thạc sĩ, Tiến sĩ của upGrad</li>
      <li style="line-height:2;font-size:14px;">Gửi thông tin người được giới thiệu về cho tôi qua Zalo: <strong>0917 500 437</strong></li>
      <li style="line-height:2;font-size:14px;">Khi học viên đăng ký nhập học, bạn nhận hoa hồng <strong>5% học phí thực thu</strong></li>
      <li style="line-height:2;font-size:14px;">Hoa hồng được thanh toán qua chuyển khoản theo tiến độ thu học phí</li>
    </ol>

    <div style="background:#fff7ed;border:1px solid #fed7aa;padding:14px 16px;border-radius:6px;margin:16px 0;font-size:13px;color:#9a3412;">
      Hoa hồng sẽ được xác nhận bằng email sau khi học viên hoàn tất thủ tục nhập học. Mức hoa hồng cụ thể phụ thuộc vào học phí thực thu của từng học viên.
    </div>

    <p style="margin:0 0 12px;line-height:1.6;">Nếu có câu hỏi: 📱 Zalo <strong>0917 500 437</strong> &nbsp;|&nbsp; 📧 <strong>tuananh@hocbong-upgrad.com</strong></p>

    <div style="margin-top:20px;font-size:14px;line-height:1.8;">
      Trân trọng,<br>
      <strong>Trần Tuấn Anh</strong><br>
      Đại lý Tuyển sinh Chiến lược — upGrad Việt Nam
    </div>
  </div>
  ${emailFooter}
</div>`,
      _logLabel: "referrer-welcome",
    });
  } catch (err) {
    console.error("sendReferrerWelcomeEmail error:", err.message);
  }
}

async function sendRefereeConfirmationEmail(referee, referrer) {
  try {
    if (!referrer.email) return;
    const apiKey = loadResendApiKey();
    if (!apiKey) return;
    await sendResendEmail(apiKey, {
      from: resolveReferralMailFrom(),
      to: referrer.email,
      subject: `Đã ghi nhận giới thiệu: ${referee.name}`,
      html: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#404040;">
  <div style="background:#E50913;padding:20px 28px;">
    <h1 style="color:white;margin:0;font-size:20px;font-weight:600;">Đã ghi nhận người bạn giới thiệu</h1>
  </div>
  <div style="padding:24px 28px;background:white;">
    <p style="margin:0 0 12px;line-height:1.6;">Xin chào <strong>${referrer.name}</strong>,</p>
    <p style="margin:0 0 12px;line-height:1.6;">Tôi đã ghi nhận thông tin học viên bạn giới thiệu. Dưới đây là chi tiết:</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;width:42%;">Họ và tên</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;"><strong>${referee.name}</strong></td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;">Số điện thoại</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;">${referee.phone}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;">Email</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;">${referee.email || "—"}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;">Chương trình quan tâm</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;">${referee.enrolled_program || referee.program_interest || "—"}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;">Mã giới thiệu</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;font-weight:700;color:#E50913;">${referrer.referral_code}</td>
      </tr>
    </table>

    <p style="margin:0 0 12px;line-height:1.6;">Tôi sẽ liên hệ với học viên này trong thời gian sớm nhất. Khi học viên đăng ký nhập học thành công, bạn sẽ nhận email xác nhận hoa hồng chi tiết.</p>
    <p style="margin:0 0 12px;line-height:1.6;">Muốn giới thiệu thêm? Gửi thông tin qua Zalo: <strong>0917 500 437</strong></p>

    <div style="margin-top:20px;font-size:14px;line-height:1.8;">
      Trân trọng,<br>
      <strong>Trần Tuấn Anh</strong><br>
      Đại lý Tuyển sinh Chiến lược — upGrad Việt Nam
    </div>
  </div>
  ${emailFooter}
</div>`,
      _logLabel: "referee-confirmation",
    });
  } catch (err) {
    console.error("sendRefereeConfirmationEmail error:", err.message);
  }
}

async function sendCommissionEmail(referee, referrer) {
  try {
    if (!referrer.email) return;
    const apiKey = loadResendApiKey();
    if (!apiKey) return;

    const installments =
      typeof referee.installments === "string"
        ? JSON.parse(referee.installments || "[]")
        : referee.installments || [];

    const installmentRows = installments
      .map(
        (inst) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e9ecef;text-align:center;">Đợt ${inst.installment_no}</td>
        <td style="padding:8px 10px;border:1px solid #e9ecef;text-align:right;">${Number(inst.amount).toLocaleString("vi-VN")} VNĐ</td>
        <td style="padding:8px 10px;border:1px solid #e9ecef;text-align:center;">${inst.due_date}</td>
        <td style="padding:8px 10px;border:1px solid #e9ecef;text-align:right;color:#E50913;font-weight:600;">${Number(inst.commission_amount).toLocaleString("vi-VN")} VNĐ</td>
        <td style="padding:8px 10px;border:1px solid #e9ecef;text-align:center;">${inst.commission_due_date}</td>
      </tr>`
      )
      .join("");

    const feeWaiverRow =
      Number(referee.fee_waiver) > 0
        ? `
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;">Fee Waiver</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;">−${Number(referee.fee_waiver).toLocaleString("vi-VN")} VNĐ</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;">Học phí thực tính hoa hồng</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;">${(Number(referee.tuition_amount) - Number(referee.fee_waiver)).toLocaleString("vi-VN")} VNĐ</td>
      </tr>`
        : "";

    await sendResendEmail(apiKey, {
      from: resolveReferralMailFrom(),
      to: referrer.email,
      subject: `Xác nhận hoa hồng giới thiệu — ${referee.name}`,
      html: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#404040;">
  <div style="background:#E50913;padding:20px 28px;">
    <h1 style="color:white;margin:0;font-size:20px;font-weight:600;">Xác nhận Hoa hồng Giới thiệu</h1>
  </div>
  <div style="padding:24px 28px;background:white;">
    <p style="margin:0 0 12px;line-height:1.6;">Xin chào <strong>${referrer.name}</strong>,</p>
    <p style="margin:0 0 12px;line-height:1.6;">Tôi xác nhận chính thức khoản hoa hồng giới thiệu cho học viên bạn đã giới thiệu:</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;width:42%;">Tên học viên</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;"><strong>${referee.name}</strong></td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;">Chương trình</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;">${referee.enrolled_program}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;">Học phí</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;">${Number(referee.tuition_amount).toLocaleString("vi-VN")} VNĐ</td>
      </tr>
      ${feeWaiverRow}
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#f8f9fa;font-weight:500;">Tỷ lệ hoa hồng</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;">${(Number(referee.commission_rate) * 100).toFixed(0)}%</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#fff7ed;font-weight:700;color:#E50913;">Tổng hoa hồng</td>
        <td style="padding:10px 14px;border:1px solid #e9ecef;background:#fff7ed;font-weight:700;color:#E50913;font-size:16px;">${Number(referee.commission_amount).toLocaleString("vi-VN")} VNĐ</td>
      </tr>
    </table>

    <p style="margin:0 0 8px;line-height:1.6;"><strong>Lịch thanh toán hoa hồng:</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;">
      <thead>
        <tr style="background:#E50913;color:white;">
          <th style="padding:8px 10px;text-align:center;border:1px solid #c0392b;">Đợt</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #c0392b;">Học phí đợt</th>
          <th style="padding:8px 10px;text-align:center;border:1px solid #c0392b;">Tháng đóng HF</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #c0392b;">Hoa hồng</th>
          <th style="padding:8px 10px;text-align:center;border:1px solid #c0392b;">Dự kiến trả</th>
        </tr>
      </thead>
      <tbody>${installmentRows}</tbody>
    </table>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px 16px;border-radius:6px;margin:16px 0;font-size:14px;color:#166534;">
      Chân thành cảm ơn sự tin tưởng và hỗ trợ của bạn trong việc giới thiệu học viên cho các chương trình của upGrad Việt Nam. Sự đồng hành của bạn là động lực để tôi tiếp tục mang đến những cơ hội học tập tốt nhất cho cộng đồng.
    </div>

    <div style="background:#fff7ed;border:1px solid #fed7aa;padding:14px 16px;border-radius:6px;margin:16px 0;font-size:13px;color:#9a3412;">
      Hoa hồng được thanh toán theo tiến độ thu học phí thực tế. Số tiền thực nhận có thể chênh lệch nhỏ do phí giao dịch ngân hàng. Vui lòng phản hồi email này để xác nhận thông tin tài khoản nhận hoa hồng.
    </div>

    <p style="margin:0 0 12px;line-height:1.6;">Phương thức thanh toán: <strong>Chuyển khoản trực tiếp</strong> vào tài khoản của bạn.</p>
    <p style="margin:0 0 12px;line-height:1.6;">📱 Zalo: <strong>0917 500 437</strong> &nbsp;|&nbsp; 📧 <strong>tuananh@hocbong-upgrad.com</strong></p>

    <div style="margin-top:20px;font-size:14px;line-height:1.8;">
      Trân trọng,<br>
      <strong>Trần Tuấn Anh</strong><br>
      Đại lý Tuyển sinh Chiến lược — upGrad Việt Nam
    </div>
  </div>
  ${emailFooter}
</div>`,
      _logLabel: "referral-commission",
    });
  } catch (err) {
    console.error("sendCommissionEmail error:", err.message);
  }
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const ip = getClientIp(req);
      if (tooManyFailedLoginAttempts(ip)) {
        return sendJson(res, 429, { error: "Too many login attempts. Please try again later." });
      }
      const body = await readJsonBody(req);
      const username = String(body.username || "");
      const password = String(body.password || "");
      if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        recordFailedLoginAttempt(ip);
        return sendJson(res, 401, { error: "Sai tên đăng nhập hoặc mật khẩu" });
      }
      clearFailedLoginAttempts(ip);
      const session = createSession(username);
      setSessionCookie(res, session.id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const currentSession = getValidSession(req);
      if (currentSession?.id) {
        sessions.delete(currentSession.id);
      }
      clearSessionCookie(res);
      res.writeHead(302, { Location: "/login" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/check") {
      const session = getValidSession(req);
      if (!session) {
        return sendJson(res, 401, { ok: false });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (
      url.pathname === "/api/digital-health" ||
      url.pathname === "/api/digital-payment-orders" ||
      /^\/api\/digital-products\/[a-z0-9-]+\/?$/.test(url.pathname) ||
      /^\/api\/digital-download\/[A-Za-z0-9]+\/?$/.test(url.pathname)
    ) {
      return sendJson(res, 410, { error: "Digital product flow is no longer available." });
    }

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
      const ip = getIpFromRequest(req);
      if (!rateLimit(apiStore, ip, 60, 60 * 60 * 1000)) {
        return sendJson(res, 429, { error: "Rate limit exceeded" });
      }
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

    if (req.method === "POST" && url.pathname === "/api/referrers") {
      const ip = getIpFromRequest(req);
      if (!rateLimit(publicFormStore, ip, 3, 60 * 60 * 1000)) {
        return sendJson(res, 429, { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." });
      }
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim();
      const phone = String(body.phone || "").trim();
      if (!name || !email || !phone) {
        return sendJson(res, 400, { error: "name, email, phone là bắt buộc" });
      }

      const phoneDigits = phone.replace(/\D/g, "");
      if (!phoneDigits) {
        return sendJson(res, 400, { error: "Số điện thoại không hợp lệ" });
      }
      const referralCode = `ref-${phoneDigits}`;
      const existing = db
        .prepare("SELECT id FROM referrers WHERE referral_code = ? LIMIT 1")
        .get(referralCode);
      if (existing) {
        return sendJson(res, 409, { error: "Số điện thoại này đã có mã referral" });
      }

      const result = db
        .prepare(
          `INSERT INTO referrers(name, email, phone, referral_code, bank_name, bank_account, bank_holder, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          name,
          email,
          phone,
          referralCode,
          body.bank_name || null,
          body.bank_account || null,
          body.bank_holder || null,
          body.notes || null
        );
      const referrer = db
        .prepare("SELECT * FROM referrers WHERE id = ? LIMIT 1")
        .get(Number(result.lastInsertRowid));
      sendReferrerWelcomeEmail(referrer);
      return sendJson(res, 201, referrer);
    }

    if (req.method === "GET" && url.pathname === "/api/referrers") {
      const rows = db
        .prepare(
          `SELECT r.*,
                  COUNT(re.id) AS referee_count
           FROM referrers r
           LEFT JOIN referees re ON re.referrer_code = r.referral_code
           GROUP BY r.id
           ORDER BY r.created_at DESC`
        )
        .all();
      return sendJson(res, 200, rows);
    }

    const referrerByCodeMatch = url.pathname.match(/^\/api\/referrers\/([^/]+)\/?$/);
    if (req.method === "GET" && referrerByCodeMatch) {
      const code = decodeURIComponent(referrerByCodeMatch[1]);
      const referrer = db
        .prepare("SELECT * FROM referrers WHERE referral_code = ? LIMIT 1")
        .get(code);
      if (!referrer) {
        return sendJson(res, 404, { error: "Not found" });
      }
      const referees = db
        .prepare(
          "SELECT * FROM referees WHERE referrer_code = ? ORDER BY created_at DESC"
        )
        .all(code);
      return sendJson(res, 200, { ...referrer, referees });
    }

    if (req.method === "PATCH" && referrerByCodeMatch) {
      const code = decodeURIComponent(referrerByCodeMatch[1]);
      const referrer = db
        .prepare("SELECT * FROM referrers WHERE referral_code = ? LIMIT 1")
        .get(code);
      if (!referrer) {
        return sendJson(res, 404, { error: "Not found" });
      }
      const body = await readJsonBody(req);
      const allowedFields = [
        "status",
        "bank_name",
        "bank_account",
        "bank_holder",
        "notes",
      ];
      const updates = [];
      const values = [];
      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }
      if (!updates.length) {
        return sendJson(res, 400, { error: "Không có trường hợp lệ để cập nhật" });
      }
      values.push(code);
      db.prepare(`UPDATE referrers SET ${updates.join(", ")} WHERE referral_code = ?`).run(
        ...values
      );
      const updated = db
        .prepare("SELECT * FROM referrers WHERE referral_code = ? LIMIT 1")
        .get(code);
      return sendJson(res, 200, updated);
    }

    if (req.method === "POST" && url.pathname === "/api/referees") {
      const body = await readJsonBody(req);
      const referrerCode = String(body.referrer_code || "").trim();
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      const email = String(body.email || "").trim();
      if (!referrerCode || !name || !phone || !email) {
        return sendJson(res, 400, { error: "referrer_code, name, phone, email là bắt buộc" });
      }

      const referrer = db
        .prepare("SELECT * FROM referrers WHERE referral_code = ? LIMIT 1")
        .get(referrerCode);
      if (!referrer) {
        return sendJson(res, 404, { error: "Mã referral không tồn tại" });
      }
      if (String(referrer.status || "active") !== "active") {
        return sendJson(res, 400, { error: "Mã referral không còn hiệu lực" });
      }

      const result = db
        .prepare(
          `INSERT INTO referees(
             referrer_code, name, email, phone, enrolled_program, tuition_amount,
             fee_waiver, commission_rate, commission_amount, financial_plan, installments, status
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
        )
        .run(
          referrerCode,
          name,
          email,
          phone,
          String(body.enrolled_program || "").trim() || null,
          Number.isFinite(Number(body.tuition_amount)) ? Number(body.tuition_amount) : null,
          Number.isFinite(Number(body.fee_waiver)) ? Number(body.fee_waiver) : 0,
          Number.isFinite(Number(body.commission_rate)) ? Number(body.commission_rate) : 0.05,
          Number.isFinite(Number(body.commission_amount)) ? Number(body.commission_amount) : null,
          String(body.financial_plan || "full").trim() || "full",
          String(body.installments || "").trim() || null
        );
      const referee = db
        .prepare("SELECT * FROM referees WHERE id = ? LIMIT 1")
        .get(Number(result.lastInsertRowid));
      sendRefereeConfirmationEmail(referee, referrer);
      return sendJson(res, 201, referee);
    }

    if (req.method === "GET" && url.pathname === "/api/referees") {
      const referrerCode = String(url.searchParams.get("referrer_code") || "").trim();
      const status = String(url.searchParams.get("status") || "").trim();
      const filters = [];
      const args = [];
      if (referrerCode) {
        filters.push("referrer_code = ?");
        args.push(referrerCode);
      }
      if (status) {
        filters.push("status = ?");
        args.push(status);
      }
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = db
        .prepare(`SELECT * FROM referees ${whereClause} ORDER BY created_at DESC`)
        .all(...args);
      return sendJson(res, 200, rows);
    }

    const refereeByIdMatch = url.pathname.match(/^\/api\/referees\/(\d+)\/?$/);
    if (req.method === "PATCH" && refereeByIdMatch) {
      const refereeId = Number(refereeByIdMatch[1]);
      const existing = db
        .prepare("SELECT * FROM referees WHERE id = ? LIMIT 1")
        .get(refereeId);
      if (!existing) {
        return sendJson(res, 404, { error: "Not found" });
      }

      const body = await readJsonBody(req);
      const allowedFields = [
        "status",
        "enrolled_program",
        "tuition_amount",
        "fee_waiver",
        "commission_rate",
        "commission_amount",
        "commission_note",
        "payment_schedule",
        "financial_plan",
        "installments",
      ];
      const updates = [];
      const values = [];
      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }
      if (!updates.length) {
        return sendJson(res, 400, { error: "Không có trường hợp lệ để cập nhật" });
      }

      const nextStatus = Object.prototype.hasOwnProperty.call(body, "status")
        ? String(body.status || "").trim()
        : existing.status;
      const incomingCommissionAmount =
        Object.prototype.hasOwnProperty.call(body, "commission_amount") &&
        body.commission_amount !== null &&
        body.commission_amount !== "";
      const shouldAutoComputeCommission =
        nextStatus === "enrolled" &&
        !incomingCommissionAmount &&
        (existing.commission_amount === null || existing.commission_amount === undefined);
      if (shouldAutoComputeCommission) {
        const tuitionRaw = Object.prototype.hasOwnProperty.call(body, "tuition_amount")
          ? body.tuition_amount
          : existing.tuition_amount;
        const rateRaw = Object.prototype.hasOwnProperty.call(body, "commission_rate")
          ? body.commission_rate
          : existing.commission_rate;
        const tuition = Number(tuitionRaw);
        const rate = Number(rateRaw);
        if (Number.isFinite(tuition) && Number.isFinite(rate)) {
          updates.push("commission_amount = ?");
          values.push(Math.round(tuition * rate));
        }
      }

      values.push(refereeId);
      db.prepare(`UPDATE referees SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      const updated = db
        .prepare("SELECT * FROM referees WHERE id = ? LIMIT 1")
        .get(refereeId);

      if (existing.status !== "enrolled" && updated.status === "enrolled") {
        const referrer = db
          .prepare("SELECT * FROM referrers WHERE referral_code = ? LIMIT 1")
          .get(updated.referrer_code);
        if (referrer) {
          sendCommissionEmail(updated, referrer);
        }
      }

      return sendJson(res, 200, updated);
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
      const ip = getIpFromRequest(req);
      if (!rateLimit(publicFormStore, ip, 5, 60 * 60 * 1000)) {
        return sendJson(res, 429, { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." });
      }
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

  if (url.pathname === "/login" || url.pathname === "/login.html") {
    return serveStaticFile(res, path.join(PUBLIC_DIR, "login.html"));
  }

  if (url.pathname === "/admin" && !requireAuth(req, res)) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (shouldProtectApiRoute(req, url.pathname) && !requireAuth(req, res)) {
      return;
    }
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

  if (url.pathname.startsWith("/san-pham/linkedin-easy-posting-machine")) {
    return sendJson(res, 410, { error: "Digital product page has been removed." });
  }

  if (url.pathname === "/sitemap.xml") {
    return serveStaticFile(res, path.join(PUBLIC_DIR, "sitemap.xml"));
  }

  if (url.pathname === "/robots.txt") {
    return serveStaticFile(res, path.join(PUBLIC_DIR, "robots.txt"));
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

  if (
    url.pathname === "/gioi-thieu-ban-be.html" ||
    url.pathname === "/gioi-thieu-ban-be/"
  ) {
    res.writeHead(301, { Location: "/gioi-thieu-ban-be" });
    res.end();
    return;
  }

  if (url.pathname === "/gioi-thieu-ban-be") {
    const referralPage = path.join(PUBLIC_DIR, "gioi-thieu-ban-be.html");
    if (!fs.existsSync(referralPage)) {
      return sendJson(res, 404, { error: "Not found" });
    }
    return serveStaticFile(res, referralPage);
  }

  if (tryServePublicStatic(res, url.pathname)) {
    return;
  }

  return sendJson(res, 404, { error: "Not found" });
}

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
