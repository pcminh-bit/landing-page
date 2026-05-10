/**
 * Resend transactional mail via REST API (no npm package — works on Node 18+ fetch).
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 * Env: RESEND_API_KEY, RESEND_FROM_EMAIL; optional RESEND_TO_EMAIL (admin).
 */

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
 * @param {{ name: string; email?: string; phone?: string; zalo?: string }} lead
 */
async function notifyWaitlistSignup(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const adminTo = String(process.env.RESEND_TO_EMAIL || "").trim();

  if (!apiKey || !from) {
    console.warn("[resend] Skip: set RESEND_API_KEY and RESEND_FROM_EMAIL");
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
<p style="margin-top:16px;color:#6b7280;font-size:13px;">Gửi tự động khi có người gửi form waitlist hoặc lead.</p>`,
      });
    }

    if (email && isLikelyEmail(email)) {
      await sendResendEmail(apiKey, {
        from,
        to: email,
        subject: "Đã nhận thông tin đăng ký — hocbong-upgrad.com",
        html: `
<p>Chào ${escapeHtml(name)},</p>
<p>Cảm ơn bạn đã để lại thông tin. Đội ngũ tư vấn sẽ liên hệ sớm qua số điện thoại hoặc email bạn đã cung cấp.</p>
<p>Trân trọng,<br/>Trần Tuấn Anh — upGrad</p>`,
      });
    }
  } catch (e) {
    console.error("[resend]", e.message || e);
  }
}

module.exports = { notifyWaitlistSignup };
