/**
 * Resend REST API (Node 18+ fetch). Key: RESEND_API_KEY hoặc file resend_config.txt (dòng bắt đầu re_).
 */
const fs = require("node:fs");
const path = require("node:path");

function loadResendApiKey() {
  const env = String(process.env.RESEND_API_KEY || "").trim();
  if (env) return env;
  const filePath = path.join(__dirname, "resend_config.txt");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const line =
    raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith("re_")) || raw.split(/\r?\n/)[0]?.trim();
  return line && line.startsWith("re_") ? line : null;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isLikelyEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

/**
 * @param {string} apiKey
 * @param {{ from: string; to: string | string[]; subject: string; html: string }} payload
 */
async function sendResendEmail(apiKey, payload) {
  const to = Array.isArray(payload.to) ? payload.to : [payload.to];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: payload.from,
      to,
      subject: payload.subject,
      html: payload.html,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : data.message?.toString?.() || JSON.stringify(data);
    throw new Error(msg || `HTTP ${response.status}`);
  }
  return data;
}

/**
 * Email nội bộ cho admin khi có lead — (không phải drip sequence).
 * @param {{ name: string; email?: string; phone?: string; zalo?: string }} lead
 */
async function notifyWaitlistSignup(lead) {
  const apiKey = loadResendApiKey();
  const from = String(process.env.RESEND_FROM_EMAIL || "").trim();
  const adminTo = String(process.env.RESEND_TO_EMAIL || "").trim();

  if (!apiKey || !from) {
    console.warn("[resend] Skip admin lead: set RESEND_FROM_EMAIL và key (env hoặc resend_config.txt)");
    return;
  }

  const name = String(lead.name || "").trim();
  const email = String(lead.email || "").trim();
  const phone = String(lead.phone || "").trim();
  const zalo = String(lead.zalo || "").trim();

  try {
    if (adminTo) {
      await sendResendEmail(apiKey, {
        from,
        to: adminTo,
        subject: `[hocbong-upgrad] Lead mới — ${name || "Khách"}`,
        html: `
<p><strong>Họ tên:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> ${escapeHtml(email) || "(trống)"}</p>
<p><strong>Số điện thoại:</strong> ${escapeHtml(phone) || "(trống)"}</p>
<p><strong>Zalo:</strong> ${escapeHtml(zalo) || "—"}</p>
<p style="margin-top:16px;color:#6b7280;font-size:13px;">Lead từ form / chatbot.</p>`,
      });
    }
  } catch (e) {
    console.error("[resend]", e.message || e);
  }
}

module.exports = {
  loadResendApiKey,
  sendResendEmail,
  escapeHtml,
  isLikelyEmail,
  notifyWaitlistSignup,
};
