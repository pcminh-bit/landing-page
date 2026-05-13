/**
 * MCP Streamable HTTP server for GoClaw (see https://docs.goclaw.sh/advanced/mcp-integration.md).
 * Binds 127.0.0.1:3001, path POST /mcp — same brain.db as the landing app.
 * Tools: waitlist_leads_recent, orders_pending_summary, order_confirm_payment
 */
const http = require("node:http");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const HOST = process.env.MCP_HOST || "127.0.0.1";
const PORT = Number(process.env.MCP_PORT || process.env.PORT_MCP || 3001);
const BRAIN_DB =
  process.env.LANDING_BRAIN_DB ||
  path.join(__dirname, "..", "brain.db");

const PROTOCOL_VERSION = "2025-03-26";

function loadEnvIfPresent() {
  const fs = require("node:fs");
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvIfPresent();

let db;
function getDb() {
  if (!db) {
    db = new DatabaseSync(BRAIN_DB);
    db.exec("PRAGMA foreign_keys = ON;");
  }
  return db;
}

function allowedOrigin(origin) {
  if (origin == null || origin === "") return true;
  const o = String(origin).toLowerCase();
  if (o.startsWith("http://127.0.0.1")) return true;
  if (o.startsWith("http://localhost")) return true;
  if (o === "null") return true;
  return false;
}

function jsonRpcResult(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id, code, message, data) {
  const err = { code, message, ...(data != null ? { data } : {}) };
  return JSON.stringify({ jsonrpc: "2.0", id, error: err });
}

function toolTextResult(obj) {
  return {
    content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
  };
}

function handleInitialize(_params) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: { listChanged: false } },
    serverInfo: {
      name: "landing-page-mcp",
      version: "1.0.0",
    },
  };
}

function handleToolsList() {
  return {
    tools: [
      {
        name: "waitlist_leads_recent",
        description:
          "Danh sách lead (customers) đăng ký waitlist gần đây từ brain.db.",
        inputSchema: {
          type: "object",
          properties: {
            since_hours: {
              type: "integer",
              description: "Số giờ lùi lại (mặc định 24).",
              default: 24,
            },
            limit: {
              type: "integer",
              description: "Tối đa bản ghi trả về (mặc định 20).",
              default: 20,
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "orders_pending_summary",
        description:
          "Đơn hàng trạng thái pending: mã đơn, khách, sản phẩm, số tiền.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "integer",
              description: "Tối đa bản ghi (mặc định 30).",
              default: 30,
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "order_confirm_payment",
        description:
          "Xác nhận đã nhận tiền: chuyển đơn từ pending sang success (giống /admin).",
        inputSchema: {
          type: "object",
          properties: {
            order_id: {
              type: "integer",
              description: "ID đơn hàng (orders.id).",
            },
          },
          required: ["order_id"],
          additionalProperties: false,
        },
      },
    ],
  };
}

function waitlistLeadsRecent(args) {
  const sinceHours = Math.min(
    24 * 30,
    Math.max(1, Number(args.since_hours ?? 24) || 24)
  );
  const limit = Math.min(100, Math.max(1, Number(args.limit ?? 20) || 20));
  const cutoffMs = Date.now() - sinceHours * 3600 * 1000;
  const d = getDb();
  const scan = Math.min(500, limit * 25);
  const rows = d
    .prepare(
      `SELECT id, name, email, phone, zalo, registered_at
       FROM customers
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(scan);
  const leads = rows
    .filter((r) => {
      if (r.registered_at == null || String(r.registered_at).trim() === "")
        return false;
      const t = new Date(String(r.registered_at).replace(" ", "T"));
      return !Number.isNaN(t.getTime()) && t.getTime() >= cutoffMs;
    })
    .slice(0, limit);
  return { leads, count: leads.length, since_hours: sinceHours };
}

function ordersPendingSummary(args) {
  const limit = Math.min(100, Math.max(1, Number(args.limit ?? 30) || 30));
  const d = getDb();
  const orders = d
    .prepare(
      `SELECT o.id, o.order_code, c.name AS customer_name, p.name AS product_name,
              o.amount, o.status, o.purchased_at
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN products p ON p.id = o.product_id
       WHERE o.status = 'pending'
       ORDER BY o.id DESC
       LIMIT ?`
    )
    .all(limit);
  const pendingCount = d
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'`)
    .get().n;
  return { orders, pending_count: Number(pendingCount) };
}

function orderConfirmPayment(args) {
  const orderId = Number(args.order_id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return { ok: false, error: "order_id không hợp lệ" };
  }
  const d = getDb();
  const info = d
    .prepare(
      "UPDATE orders SET status = 'success' WHERE id = ? AND status = 'pending'"
    )
    .run(orderId);
  if (!info.changes) {
    return {
      ok: false,
      order_id: orderId,
      error:
        "Không cập nhật được: đơn không tồn tại hoặc không còn trạng thái chờ thanh toán.",
    };
  }
  return { ok: true, order_id: orderId, status: "success" };
}

function handleToolsCall(params) {
  const name = params?.name;
  const args = params?.arguments && typeof params.arguments === "object"
    ? params.arguments
    : {};
  if (name === "waitlist_leads_recent") {
    return toolTextResult(waitlistLeadsRecent(args));
  }
  if (name === "orders_pending_summary") {
    return toolTextResult(ordersPendingSummary(args));
  }
  if (name === "order_confirm_payment") {
    return toolTextResult(orderConfirmPayment(args));
  }
  throw new Error(`Unknown tool: ${name}`);
}

function processOneMessage(msg) {
  if (msg == null || typeof msg !== "object") {
    return jsonRpcError(null, -32600, "Invalid Request");
  }
  const { jsonrpc, method, params, id } = msg;
  if (jsonrpc !== "2.0") {
    return id != null
      ? jsonRpcError(id, -32600, "Invalid Request")
      : null;
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return id != null ? jsonRpcResult(id, {}) : "notification";
  }

  if (id == null) {
    if (method === "ping") return "notification";
    return null;
  }

  try {
    if (method === "initialize") {
      return jsonRpcResult(id, handleInitialize(params));
    }
    if (method === "tools/list") {
      return jsonRpcResult(id, handleToolsList());
    }
    if (method === "tools/call") {
      return jsonRpcResult(id, handleToolsCall(params));
    }
    return jsonRpcError(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    return jsonRpcError(
      id,
      -32603,
      e.message || "Internal error",
      undefined
    );
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

function isOnlyNotificationsOrResponses(batch) {
  return batch.every((m) => {
    if (m == null || typeof m !== "object") return false;
    if (m.method === "notifications/initialized") return true;
    if (m.method && String(m.method).startsWith("notifications/"))
      return true;
    if (m.result !== undefined && m.id == null) return true;
    return false;
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/mcp") {
    res.writeHead(405, { Allow: "POST" });
    res.end();
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/mcp") {
    res.writeHead(405);
    res.end();
    return;
  }

  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST" });
    res.end();
    return;
  }

  const origin = req.headers.origin;
  if (!allowedOrigin(origin)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Origin not allowed" }));
    return;
  }

  const accept = req.headers.accept || "";
  if (
    !accept.includes("application/json") &&
    !accept.includes("text/event-stream")
  ) {
    res.writeHead(406, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Accept must include application/json and text/event-stream",
      })
    );
    return;
  }

  let bodyRaw;
  try {
    bodyRaw = await readBody(req);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }

  let payload;
  try {
    payload = bodyRaw ? JSON.parse(bodyRaw) : null;
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(jsonRpcError(null, -32700, "Parse error"));
    return;
  }

  const batch = Array.isArray(payload) ? payload : [payload];

  const hasRequest = batch.some(
    (m) => m && typeof m === "object" && m.id != null && m.method
  );

  if (!hasRequest && isOnlyNotificationsOrResponses(batch)) {
    res.writeHead(202);
    res.end();
    return;
  }

  const out = [];
  for (const msg of batch) {
    const line = processOneMessage(msg);
    if (line === "notification") continue;
    if (line == null) continue;
    out.push(JSON.parse(line));
  }

  const single = !Array.isArray(payload);
  const responseBody = single && out.length === 1 ? out[0] : out;

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(responseBody));
});

server.listen(PORT, HOST, () => {
  console.error(
    `[mcp] Streamable HTTP at http://${HOST}:${PORT}/mcp (db: ${BRAIN_DB})`
  );
});
