/**
 * Resend transactional mail — docs: https://resend.com/docs
 * Requires: RESEND_API_KEY, RESEND_FROM_EMAIL (verified domain).
 * Optional: RESEND_TO_EMAIL — admin inbox for lead notifications.
 */
const { Resend } = require("resend");

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

  const resend = new Resend(apiKey);
  const name = String(lead.name || "").trim();
  const email = String(lead.email || "").trim();
  const phone = String(lead.phone || "").trim();
  const zalo = String(lead.zalo || "").trim();

  try {
    if (adminTo) {
      const { error: errAdmin } = await resend.emails.send({
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
      if (errAdmin) console.error("[resend] Admin notify failed:", errAdmin);
    }

    if (email && isLikelyEmail(email)) {
      const { error: errSelf } = await resend.emails.send({
        from,
        to: email,
        subject: "Đã nhận thông tin đăng ký — hocbong-upgrad.com",
        html: `
<p>Chào ${escapeHtml(name)},</p>
<p>Cảm ơn bạn đã để lại thông tin. Đội ngũ tư vấn sẽ liên hệ sớm qua số điện thoại hoặc email bạn đã cung cấp.</p>
<p>Trân trọng,<br/>Trần Tuấn Anh — upGrad</p>`,
      });
      if (errSelf) console.error("[resend] Customer thank-you failed:", errSelf);
    }
  } catch (e) {
    console.error("[resend]", e.message || e);
  }
}

module.exports = { notifyWaitlistSignup };
