/**
 * Gửi mail qua Resend:
 * - Trên Vercel (VERCEL=1) hoặc khi RESEND_USE_SMTP=1: SMTP smtp.resend.com + nodemailer (tránh REST fetch tới api.resend.com).
 * - Còn lại: REST POST (fetch) tới https://api.resend.com/emails.
 *
 * Key: RESEND_API_KEY hoặc file resend_config.txt (dòng bắt đầu re_).
 *
 * Logging: mặc định tóm tắt + lỗi đầy đủ; chi tiết: RESEND_MAIL_LOG=1.
 * Buộc REST trên Vercel (debug): RESEND_USE_REST=1.
 */
const fs = require("node:fs");
const path = require("node:path");

const RESEND_CONFIG_FILE = path.join(__dirname, "resend_config.txt");

function resendVerbose() {
  return (
    process.env.RESEND_MAIL_LOG === "1" ||
    process.env.RESEND_MAIL_LOG === "true"
  );
}

/** Không log full key — chỉ prefix/suffix để nhận diện. */
function maskApiKey(key) {
  const s = String(key || "");
  if (!s) return "(empty)";
  if (s.length < 10) return `(short len=${s.length})`;
  return `${s.slice(0, 5)}…${s.slice(-4)} (len=${s.length})`;
}

/**
 * @returns {{ key: string | null, source: 'env' | 'file' | 'none', fileExists: boolean, detail?: string }}
 */
function describeApiKeyResolution() {
  const envRaw = process.env.RESEND_API_KEY;
  const env = envRaw ? String(envRaw).trim() : "";
  const fileExists = fs.existsSync(RESEND_CONFIG_FILE);

  if (env) {
    return {
      key: env,
      source: "env",
      fileExists,
      detail: maskApiKey(env),
    };
  }

  if (!fileExists) {
    return {
      key: null,
      source: "none",
      fileExists: false,
      detail:
        "Không có RESEND_API_KEY trong env và không tìm thấy resend_config.txt — trên Vercel cần set env RESEND_API_KEY.",
    };
  }

  try {
    const raw = fs.readFileSync(RESEND_CONFIG_FILE, "utf-8");
    const line =
      raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.startsWith("re_")) || raw.split(/\r?\n/)[0]?.trim();
    if (line && line.startsWith("re_")) {
      return {
        key: line,
        source: "file",
        fileExists: true,
        detail: maskApiKey(line),
      };
    }
    return {
      key: null,
      source: "none",
      fileExists: true,
      detail:
        "resend_config.txt tồn tại nhưng không có dòng hợp lệ (bắt đầu re_). Kiểm tra nội dung file.",
    };
  } catch (e) {
    return {
      key: null,
      source: "none",
      fileExists: true,
      detail: `Đọc resend_config.txt lỗi: ${e.message}`,
    };
  }
}

function loadResendApiKey() {
  return describeApiKeyResolution().key;
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
 * Log lần resolve key (helper cho debug route / sequence).
 */
function logResendKeyStatus(context = "load") {
  const meta = describeApiKeyResolution();
  console.log(
    `[resend:key] (${context}) source=${meta.source} file_exists=${meta.fileExists} key=${meta.detail}`
  );
  return meta;
}

/** 5 ký tự đầu — đủ nhận biết env có inject trên Vercel hay không (không log full key). */
function envResendKeyPrefix5() {
  const v = process.env.RESEND_API_KEY;
  if (v == null || String(v).trim() === "") return "(unset)";
  return String(v).trim().slice(0, 5);
}

function useResendSmtpChannel() {
  if (
    process.env.RESEND_USE_REST === "1" ||
    process.env.RESEND_USE_REST === "true"
  ) {
    return false;
  }
  return (
    process.env.VERCEL === "1" ||
    process.env.RESEND_USE_SMTP === "1" ||
    process.env.RESEND_USE_SMTP === "true"
  );
}

let cachedSmtpTransport = null;
let cachedSmtpPass = "";

/** Resend SMTP: https://resend.com/docs/send-with-smtp-nodemailer */
function getResendSmtpTransport(apiKey) {
  const pass = String(apiKey || "").trim();
  if (!pass) return null;
  const nodemailer = require("nodemailer");
  const port = Number(process.env.RESEND_SMTP_PORT || "465");
  const secure = port === 465;
  if (cachedSmtpTransport && cachedSmtpPass === pass) {
    return cachedSmtpTransport;
  }
  cachedSmtpTransport = nodemailer.createTransport({
    host: "smtp.resend.com",
    port,
    secure,
    auth: { user: "resend", pass },
    // Vercel: giữ handshake nhanh, tránh treo idle
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 45_000,
  });
  cachedSmtpPass = pass;
  return cachedSmtpTransport;
}

/**
 * @returns {Promise<{ id: string | null }>}
 */
async function sendResendViaSmtp(apiKey, resendBody, to, label) {
  const transport = getResendSmtpTransport(apiKey);
  if (!transport) {
    throw new Error("SMTP: missing API key for auth");
  }
  const t0 = Date.now();
  try {
    const info = await transport.sendMail({
      from: resendBody.from,
      to,
      subject: resendBody.subject,
      html: resendBody.html,
    });
    const ms = Date.now() - t0;
    const id =
      info.messageId && typeof info.messageId === "string"
        ? info.messageId.replace(/[<>]/g, "")
        : null;
    console.log("[resend:send:ok]", {
      label,
      via: "smtp",
      ms,
      resendId: id,
      response: info.response?.slice?.(0, 200),
    });
    if (resendVerbose()) {
      console.log("[resend:send:smtp:info]", {
        envelope: info.envelope,
        messageId: info.messageId,
      });
    }
    return { id };
  } catch (smtpErr) {
    const ms = Date.now() - t0;
    console.error("[resend:send:error]", {
      label,
      via: "smtp",
      ms,
      code: smtpErr.code,
      command: smtpErr.command,
      response: smtpErr.response,
      message: smtpErr.message,
      stack: resendVerbose() ? smtpErr.stack : undefined,
    });
    throw smtpErr;
  }
}

/**
 * Gửi mail qua Bearer `apiKey` (tham số). Key **không** đọc trong hàm này — caller truyền từ
 * `loadResendApiKey()` / `describeApiKeyResolution()` (env `RESEND_API_KEY` trước, sau đó file).
 *
 * @param {string} apiKey
 * @param {{ from: string; to: string | string[]; subject: string; html: string }} payload
 */
async function sendResendEmail(apiKey, payload) {
  const { _logLabel, ...resendBody } = payload;
  const label = _logLabel || "send";
  const to = Array.isArray(resendBody.to) ? resendBody.to : [resendBody.to];

  const envP = envResendKeyPrefix5();
  const bearerP =
    apiKey && String(apiKey).trim()
      ? String(apiKey).trim().slice(0, 5)
      : "(empty)";
  const smtp = useResendSmtpChannel();
  console.log("[resend:send:env-check]", {
    process_env_RESEND_API_KEY_first5: envP,
    bearer_apiKey_first5: bearerP,
    VERCEL: process.env.VERCEL === "1",
    channel: smtp ? "smtp" : "rest",
  });

  if (resendVerbose()) {
    console.log("[resend:send:start]", {
      label,
      from: resendBody.from,
      to,
      subject: resendBody.subject?.slice?.(0, 80),
      htmlLen: String(resendBody.html || "").length,
    });
  }

  if (smtp) {
    return sendResendViaSmtp(apiKey, resendBody, to, label);
  }

  const t0 = Date.now();
  let response;
  let rawText = "";

  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendBody.from,
        to,
        subject: resendBody.subject,
        html: resendBody.html,
      }),
    });
    rawText = await response.text();
  } catch (netErr) {
    console.error("[resend:send:network]", {
      label,
      via: "rest",
      message: netErr.message,
      name: netErr.name,
      stack: resendVerbose() ? netErr.stack : undefined,
    });
    throw netErr;
  }

  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { _raw: rawText };
  }

  const ms = Date.now() - t0;

  if (!response.ok) {
    console.error("[resend:send:error]", {
      label,
      via: "rest",
      httpStatus: response.status,
      ms,
      responseBody: data,
      rawSnippet: typeof rawText === "string" ? rawText.slice(0, 500) : rawText,
    });
    const msg =
      typeof data.message === "string"
        ? data.message
        : Array.isArray(data.message)
          ? JSON.stringify(data.message)
          : data.message?.toString?.() || JSON.stringify(data);
    throw new Error(msg || `HTTP ${response.status}`);
  }

  console.log("[resend:send:ok]", {
    label,
    via: "rest",
    httpStatus: response.status,
    ms,
    resendId: data.id || null,
  });
  if (resendVerbose()) {
    console.log("[resend:send:responseBody]", JSON.stringify(data));
  }

  return data;
}

/**
 * Email nội bộ cho admin khi có lead — (không phải drip sequence).
 * @param {{ name: string; email?: string; phone?: string; zalo?: string }} lead
 */
async function notifyWaitlistSignup(lead) {
  logResendKeyStatus("notifyWaitlistSignup");
  const apiKey = loadResendApiKey();
  const from = String(process.env.RESEND_FROM_EMAIL || "").trim();
  const adminTo = String(process.env.RESEND_TO_EMAIL || "").trim();

  if (!apiKey || !from) {
    console.warn(
      "[resend] Skip admin lead: thiếu API key hoặc RESEND_FROM_EMAIL",
      {
        hasKey: Boolean(apiKey),
        fromPresent: Boolean(from),
        adminConfigured: Boolean(adminTo),
      }
    );
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
<p style="margin-top:14px;color:#6b7280;font-size:13px;">Lead từ form / chatbot.</p>`,
        _logLabel: "admin-lead",
      });
    } else {
      console.warn("[resend] RESEND_TO_EMAIL trống — bỏ qua mail admin.");
    }
  } catch (e) {
    console.error("[resend] notifyWaitlistSignup failed:", e.message || e);
  }
}

module.exports = {
  describeApiKeyResolution,
  loadResendApiKey,
  sendResendEmail,
  escapeHtml,
  isLikelyEmail,
  notifyWaitlistSignup,
  logResendKeyStatus,
  maskApiKey,
};
