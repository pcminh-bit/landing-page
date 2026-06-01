/**
 * Gửi mail qua Resend REST API (fetch):
 * POST https://api.resend.com/emails
 *
 * Key: RESEND_API_KEY hoặc file resend_config.txt (dòng bắt đầu re_).
 * Logging: mặc định tóm tắt + lỗi đầy đủ; chi tiết: RESEND_MAIL_LOG=1.
 */
const fs = require("node:fs");
const path = require("node:path");

const RESEND_CONFIG_FILE = path.join(__dirname, "resend_config.txt");
const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_HTTP_TIMEOUT_MS = 15_000;

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
        "Không có RESEND_API_KEY trong env và không tìm thấy resend_config.txt — set RESEND_API_KEY trong .env hoặc .env.production.",
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
 * @returns {{ fromEmail: string | null, source: 'env' | 'file' | 'none', fileExists: boolean, detail?: string }}
 */
function describeFromEmailResolution() {
  const envRaw = process.env.RESEND_FROM_EMAIL;
  const env = envRaw ? String(envRaw).trim() : "";
  const fileExists = fs.existsSync(RESEND_CONFIG_FILE);

  if (env) {
    return {
      fromEmail: env,
      source: "env",
      fileExists,
      detail: env,
    };
  }

  if (!fileExists) {
    return {
      fromEmail: null,
      source: "none",
      fileExists: false,
      detail: "Thiếu RESEND_FROM_EMAIL và không có resend_config.txt.",
    };
  }

  try {
    const raw = fs.readFileSync(RESEND_CONFIG_FILE, "utf-8");
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => Boolean(l) && !l.startsWith("#"));
    const kvCandidates = [
      "RESEND_FROM_EMAIL=",
      "FROM_EMAIL=",
      "from=",
      "sender=",
    ];
    const kvLine = lines.find((line) =>
      kvCandidates.some((prefix) => line.startsWith(prefix))
    );
    if (kvLine) {
      const email = String(kvLine.split("=").slice(1).join("=") || "").trim();
      if (isLikelyEmail(email)) {
        return {
          fromEmail: email,
          source: "file",
          fileExists: true,
          detail: email,
        };
      }
    }

    const emailLine = lines.find((line) => isLikelyEmail(line));
    if (emailLine) {
      return {
        fromEmail: emailLine,
        source: "file",
        fileExists: true,
        detail: emailLine,
      };
    }

    return {
      fromEmail: null,
      source: "none",
      fileExists: true,
      detail:
        "resend_config.txt không có email sender hợp lệ. Thêm RESEND_FROM_EMAIL=you@hocbong-upgrad.com",
    };
  } catch (e) {
    return {
      fromEmail: null,
      source: "none",
      fileExists: true,
      detail: `Đọc resend_config.txt lỗi: ${e.message}`,
    };
  }
}

function loadResendFromEmail() {
  return describeFromEmailResolution().fromEmail;
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

function logResendFromStatus(context = "load") {
  const meta = describeFromEmailResolution();
  console.log(
    `[resend:from] (${context}) source=${meta.source} file_exists=${meta.fileExists} from=${meta.detail}`
  );
  return meta;
}

/** 5 ký tự đầu — đủ nhận biết env có inject hay không (không log full key). */
function envResendKeyPrefix5() {
  const v = process.env.RESEND_API_KEY;
  if (v == null || String(v).trim() === "") return "(unset)";
  return String(v).trim().slice(0, 5);
}

function truncate(value, max = 400) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function formatVnd(value) {
  const n = Number(value || 0);
  return `${n.toLocaleString("vi-VN")} VNĐ`;
}

/**
 * Gửi mail qua Bearer `apiKey`.
 * Caller truyền từ `loadResendApiKey()` / `describeApiKeyResolution()`.
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
  console.log("[resend:send:env-check]", {
    process_env_RESEND_API_KEY_first5: envP,
    bearer_apiKey_first5: bearerP,
    channel: "rest-fetch",
    endpoint: RESEND_API_URL,
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

  const token = String(apiKey || "").trim();
  if (!token) {
    throw new Error("Thiếu RESEND_API_KEY để gọi Resend API.");
  }

  const t0 = Date.now();
  const body = {
    from: resendBody.from,
    to,
    subject: resendBody.subject,
    html: resendBody.html,
  };
  const sender = String(body.from || "").toLowerCase().trim();
  if (sender.includes("onboarding@resend.dev")) {
    console.warn(
      "[resend:from-warning] onboarding@resend.dev chỉ gửi được tới email chính chủ Resend; hãy dùng sender đã verify domain."
    );
  }

  console.log("[resend:rest] before fetch", {
    label,
    from: body.from,
    toCount: to.length,
    subjectSlice: String(body.subject || "").slice(0, 80),
    timeoutMs: RESEND_HTTP_TIMEOUT_MS,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_HTTP_TIMEOUT_MS);

  let response;
  let rawText = "";
  try {
    response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    rawText = await response.text();
  } catch (error) {
    const ms = Date.now() - t0;
    const errorResponse = error?.response || null;
    console.error("[resend:send:error]", {
      label,
      via: "rest-fetch",
      ms,
      message: error?.message || String(error),
      response: errorResponse,
      stack: resendVerbose() ? error?.stack : undefined,
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { _raw: rawText };
  }

  const ms = Date.now() - t0;
  const httpStatus = Number(response.status || 0);
  const ok = response.ok;
  const responseDetail = {
    status: httpStatus,
    body: truncate(data),
  };
  console.log("[resend:rest] after fetch", { label, ms, status: httpStatus });

  if (!ok) {
    const apiError = new Error(
      typeof data?.message === "string"
        ? data.message
        : `Resend API failed with HTTP ${httpStatus}`
    );
    apiError.response = responseDetail;
    console.error("[resend:send:error]", {
      label,
      via: "rest-fetch",
      ms,
      message: apiError.message,
      response: apiError.response,
    });
    throw apiError;
  }

  const id = data?.id || null;
  console.log("[resend:send:ok]", {
    label,
    via: "rest-fetch",
    ms,
    httpStatus,
    resendId: id,
  });
  if (resendVerbose()) {
    console.log("[resend:send:responseBody]", truncate(data, 1200));
  }

  return { id };
}

/**
 * Email nội bộ cho admin khi có lead — (không phải drip sequence).
 * @param {{ name: string; email?: string; phone?: string; zalo?: string }} lead
 */
async function notifyWaitlistSignup(lead) {
  logResendKeyStatus("notifyWaitlistSignup");
  logResendFromStatus("notifyWaitlistSignup");
  const apiKey = loadResendApiKey();
  const from = String(loadResendFromEmail() || "").trim();
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
    console.error("[resend] notifyWaitlistSignup failed:", {
      message: e?.message || String(e),
      response: e?.response || null,
    });
  }
}

/**
 * Gửi email xác nhận đơn hàng khi admin tạo đơn mới trong /admin.
 * @param {{ customerName?: string; customerEmail?: string; productName?: string; amount?: number; orderCode?: string }} order
 */
async function sendOrderCreatedConfirmation(order) {
  logResendKeyStatus("sendOrderCreatedConfirmation");
  logResendFromStatus("sendOrderCreatedConfirmation");
  const apiKey = loadResendApiKey();
  const from = String(loadResendFromEmail() || "").trim();
  const to = String(order.customerEmail || "").trim();

  if (!apiKey || !from) {
    console.warn("[resend] Skip order-confirmation: thiếu API key hoặc RESEND_FROM_EMAIL", {
      hasKey: Boolean(apiKey),
      fromPresent: Boolean(from),
    });
    return { skipped: true, reason: "missing_sender_or_key" };
  }
  if (!isLikelyEmail(to)) {
    console.warn("[resend] Skip order-confirmation: email khách không hợp lệ.", {
      to: to || "(trống)",
    });
    return { skipped: true, reason: "invalid_customer_email" };
  }

  const customerName = String(order.customerName || "").trim() || "bạn";
  const productName = String(order.productName || "").trim() || "gói đã đăng ký";
  const amountText = formatVnd(order.amount);
  const orderCode = String(order.orderCode || "").trim();
  const paymentUrl = "https://hocbong-upgrad.com/payment";

  const subject = `Xác nhận đơn hàng ${orderCode ? `#${orderCode}` : ""} — ${productName}`;
  const html = `
<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111827;font-size:16px;">
  <p>Chào ${escapeHtml(customerName)},</p>
  <p>Mình xác nhận team đã tạo đơn cho bạn rồi, không vòng vo.</p>
  <p><strong>Thông tin đơn hàng:</strong></p>
  <p>→ Sản phẩm: <strong>${escapeHtml(productName)}</strong><br/>
  → Số tiền: <strong>${escapeHtml(amountText)}</strong>${orderCode ? `<br/>→ Mã đơn: <strong>${escapeHtml(orderCode)}</strong>` : ""}</p>
  <p><strong>Hướng dẫn nhận hàng:</strong></p>
  <p>1) Giữ lại email này để đối chiếu.<br/>
  2) Team sẽ liên hệ qua số điện thoại/Zalo đã đăng ký để chốt bước bàn giao.<br/>
  3) Nếu cần kiểm tra trạng thái nhanh, vào <a href="${paymentUrl}">${paymentUrl}</a> và nhập đúng mã đơn.</p>
  <p>Cảm ơn bạn đã tin tưởng. Team sẽ xử lý gọn, đúng việc, để bạn không mất thời gian.</p>
  <p><strong>p/s:</strong> Nếu cần ưu tiên xử lý trong hôm nay, chỉ cần reply email này một dòng.</p>
  <p>— Tuấn Anh</p>
</div>`;

  try {
    await sendResendEmail(apiKey, {
      from,
      to,
      subject,
      html,
      _logLabel: "order-created-confirmation",
    });
    return { ok: true };
  } catch (e) {
    console.error("[resend] sendOrderCreatedConfirmation failed:", {
      message: e?.message || String(e),
      response: e?.response || null,
    });
    throw e;
  }
}

/**
 * Gửi link tải sản phẩm số sau khi thanh toán thành công.
 * @param {{ customerName?: string; customerEmail?: string; productName?: string; downloadUrl?: string }} payload
 */
async function sendDigitalProductDelivery(payload) {
  logResendKeyStatus("sendDigitalProductDelivery");
  logResendFromStatus("sendDigitalProductDelivery");
  const apiKey = loadResendApiKey();
  const from = String(loadResendFromEmail() || "").trim();
  const to = String(payload.customerEmail || "").trim();

  if (!apiKey || !from) {
    console.warn("[resend] Skip digital delivery: thiếu API key hoặc RESEND_FROM_EMAIL");
    return { skipped: true, reason: "missing_sender_or_key" };
  }
  if (!isLikelyEmail(to)) {
    console.warn("[resend] Skip digital delivery: email khách không hợp lệ.", { to: to || "(trống)" });
    return { skipped: true, reason: "invalid_customer_email" };
  }

  const customerName = String(payload.customerName || "").trim() || "bạn";
  const productName = String(payload.productName || "").trim() || "sản phẩm số";
  const downloadUrl = String(payload.downloadUrl || "").trim();
  if (!downloadUrl) {
    console.warn("[resend] Skip digital delivery: thiếu downloadUrl");
    return { skipped: true, reason: "missing_download_url" };
  }

  const subject = `${productName} — File của bạn đã sẵn sàng`;
  const html = `
<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111827;font-size:16px;">
  <p>Chào ${escapeHtml(customerName)},</p>
  <p>Cảm ơn bạn đã mua <strong>${escapeHtml(productName)}</strong>.</p>
  <p>Bấm vào link dưới để tải file về máy:</p>
  <p><a href="${escapeHtml(downloadUrl)}" style="color:#e50913;font-weight:600;">Tải sản phẩm (ZIP)</a></p>
  <p style="color:#6b7280;font-size:14px;">Lưu email này nếu cần tải lại sau.</p>
  <p>Nếu cần hỗ trợ: reply email này hoặc Zalo trên website.</p>
  <p>Trần Tuấn Anh<br/><a href="https://www.hocbong-upgrad.com">hocbong-upgrad.com</a></p>
</div>`;

  try {
    await sendResendEmail(apiKey, {
      from,
      to,
      subject,
      html,
      text: `Chào ${customerName},\n\nCảm ơn bạn đã mua ${productName}.\n\nTải file: ${downloadUrl}\n\nTrần Tuấn Anh`,
      _logLabel: "digital-product-delivery",
    });
    return { ok: true };
  } catch (e) {
    console.error("[resend] sendDigitalProductDelivery failed:", {
      message: e?.message || String(e),
      response: e?.response || null,
    });
    throw e;
  }
}

module.exports = {
  describeApiKeyResolution,
  describeFromEmailResolution,
  loadResendApiKey,
  loadResendFromEmail,
  sendResendEmail,
  escapeHtml,
  isLikelyEmail,
  notifyWaitlistSignup,
  sendOrderCreatedConfirmation,
  sendDigitalProductDelivery,
  logResendKeyStatus,
  logResendFromStatus,
  maskApiKey,
};
