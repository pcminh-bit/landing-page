/**
 * Waitlist drip sequence — nội dung theo email_sequence.md (HTML).
 * SQLite: table email_sequence_jobs. Postgres: snapshot.email_sequence_jobs[]
 */
const {
  sendResendEmail,
  loadResendApiKey,
  isLikelyEmail,
  escapeHtml,
  describeApiKeyResolution,
  logResendKeyStatus,
} = require("./resend-mail");

const { nextId } = require("./pg-store");
const MAX_JOBS_PER_RUN = Number(process.env.EMAIL_SEQUENCE_MAX_PER_RUN || "10");

function sqliteUtcFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

function paymentPageUrl() {
  const base = String(process.env.PUBLIC_SITE_URL || "https://hocbong-upgrad.com").replace(/\/+$/, "");
  return `${base}/payment`;
}

function isSequenceTestEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  return local.includes("+test");
}

function utcSqliteDatetimeFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

function greetingName(name) {
  const n = String(name || "").trim();
  return n ? escapeHtml(n) : "bạn";
}

/** @returns {{ subject: string, htmlParts: string[] }} */
function buildEmailStep(step, name, paymentUrl) {
  const who = greetingName(name);
  if (step === 1) {
    return {
      subject: "Cảm ơn bạn đã để lại thông tin",
      htmlParts: [
        `<p>Chào ${who},</p>`,
        `<p>Mình là <strong>Trần Tuấn Anh</strong>, đại lý tuyển sinh của upGrad — làm việc với người đi làm bận, muốn nâng bằng cấp mà không thích vòng vo.</p>`,
        `<p>Thật ra, chỉ muốn nói nhanh: <strong>bạn đã làm đúng bước đầu</strong>. Mình nhận được form của bạn rồi.</p>`,
        `<p>Trong vài ngày tới, mình hoặc team sẽ liên hệ để không lãng phí thời gian của bạn — chỉ đúng việc, đúng hướng.</p>`,
        `<p><strong>p/s:</strong> Bạn đang ưu tiên nhất lúc này là <strong>thời gian</strong>, <strong>chi phí</strong>, hay <strong>bằng cấp</strong>? Trả lời một chữ thôi cũng được, mình chỉnh tư vấn cho khớp.</p>`,
        `<p>— Tuấn Anh</p>`,
      ],
    };
  }
  if (step === 2) {
    return {
      subject: "80% việc quan trọng nằm ở 20% này thôi",
      htmlParts: [
        `<p>Bạn có cảm giác làm một lúc… quá nhiều thứ không?</p>`,
        `<p>Đơn giản thôi: <strong>80% kết quả thường đến từ một nhóm nhỏ việc.</strong> Không nhất thiết “làm thêm”. Mà là <strong>làm đúng</strong>.</p>`,
        `<p>Với người đi làm bận (như mình hay gặp), thử xem 3 câu này:</p>`,
        `<p>→ Việc nào nếu bỏ thì gần như không sao?<br/>`,
        `→ Việc nào nếu làm sẽ kéo theo cả chuỗi lợi ích?<br/>`,
        `→ Việc nào <strong>chỉ bạn</strong> quyết được trong 7 ngày tới?</p>`,
        `<p>Không bán gì ở đây. Chỉ muốn bạn <strong>bớt dàn trải</strong>, tập trung đúng chỗ.</p>`,
        `<p><strong>p/s:</strong> Trong 7 ngày tới, bạn chọn được <strong>một</strong> việc ưu tiên chưa? Trả lời mình một dòng cũng được.</p>`,
        `<p>— Tuấn Anh</p>`,
      ],
    };
  }
  const pay = escapeHtml(paymentUrl);
  return {
    subject: "Nếu bạn đã sẵn sàng — bước tiếp theo rất rõ",
    htmlParts: [
      `<p>Chào ${who},</p>`,
      `<p>Mình nói thẳng.</p>`,
      `<p>Trong hệ thống hiện có sản phẩm <strong>Test Product</strong> — <strong>100.000 VNĐ</strong> (mô tả trong kho: <em>demo</em>). Đây là bước <strong>xác nhận quan tâm / giữ hành động</strong> nếu bạn muốn đi tiếp, không cần phức tạp.</p>`,
      `<p><strong>Bạn nhận được gì (thật, không vẽ thêm):</strong></p>`,
      `<p>→ Một bước rõ ràng trên hệ thống thanh toán (có mã đơn, dễ đối chiếu).<br/>`,
      `→ Team biết bạn <strong>serious</strong> — ưu tiên hỗ trợ cho đúng người.<br/>`,
      `→ Không vòng vo: làm xong là xong, để mình lo phần tiếp theo với bạn.</p>`,
      `<p><strong>CTA — Thanh toán ngay:</strong><br/><a href="${pay}">${pay}</a></p>`,
      `<p>Vào trang → điền form → chuyển khoản đúng <strong>mã đơn</strong> hiện trên màn hình.</p>`,
      `<p>Nếu chưa muốn bước này — không sao. Cứ trả lời mình một dòng, mình dừng nhắc.</p>`,
      `<p><strong>p/s:</strong> Bạn muốn mình gọi <strong>sáng</strong> hay <strong>chiều</strong> tuần này?</p>`,
      `<p>— Tuấn Anh</p>`,
    ],
  };
}

async function sendSequenceStep(apiKey, from, toEmail, name, step) {
  const { subject, htmlParts } = buildEmailStep(step, name, paymentPageUrl());
  const html =
    `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111827;font-size:16px;">` +
    htmlParts.join("") +
    `</div>`;
  console.log("[email-sequence:sendStep] bắt đầu", {
    step,
    to: toEmail,
    from,
    subjectSlice: subject.slice(0, 60),
  });
  await sendResendEmail(apiKey, {
    from,
    to: toEmail,
    subject,
    html,
    _logLabel: `waitlist-sequence-step-${step}`,
  });
  console.log("[email-sequence:sendStep] xong step", step, "→", toEmail);
}

/**
 * SQLite: enqueue step 2 and 3
 */
function enqueueSequenceSqlite(db, email, name) {
  const now = Date.now();
  const t2 = utcSqliteDatetimeFromMs(now + 2 * 24 * 60 * 60 * 1000);
  const t3 = utcSqliteDatetimeFromMs(now + 3 * 24 * 60 * 60 * 1000);
  db.prepare("DELETE FROM email_sequence_jobs WHERE to_email = ? AND sent_at IS NULL").run(email);
  db.prepare(
    "INSERT INTO email_sequence_jobs(to_email, to_name, step, send_at) VALUES (?, ?, 2, ?)"
  ).run(email, name, t2);
  db.prepare(
    "INSERT INTO email_sequence_jobs(to_email, to_name, step, send_at) VALUES (?, ?, 3, ?)"
  ).run(email, name, t3);
}

/**
 * Postgres JSON snapshot enqueue
 */
function enqueueSequencePostgres(snapshot, email, name) {
  if (!Array.isArray(snapshot.email_sequence_jobs)) snapshot.email_sequence_jobs = [];
  const now = Date.now();
  const t2 = sqliteUtcFromMs(now + 2 * 24 * 60 * 60 * 1000);
  const t3 = sqliteUtcFromMs(now + 3 * 24 * 60 * 60 * 1000);
  snapshot.email_sequence_jobs = snapshot.email_sequence_jobs.filter(
    (j) => !(String(j.to_email) === email && !j.sent_at)
  );
  snapshot.email_sequence_jobs.push({
    id: nextId(snapshot.email_sequence_jobs),
    to_email: email,
    to_name: name,
    step: 2,
    send_at: t2,
    sent_at: null,
  });
  snapshot.email_sequence_jobs.push({
    id: nextId(snapshot.email_sequence_jobs),
    to_email: email,
    to_name: name,
    step: 3,
    send_at: t3,
    sent_at: null,
  });
}

/**
 * @param {{ name: string, email?: string }} lead
 * @param {{ sqlite?: object } | { postgresMutate?: (fn: Function) => Promise<any> }} storage
 */
async function runWaitlistSignupSequence(lead, storage = {}) {
  const email = String(lead.email || "").trim();
  const name = String(lead.name || "").trim();

  console.log("[email-sequence] runWaitlistSignupSequence vào", {
    emailPresent: Boolean(email),
    emailValid: isLikelyEmail(email),
    nameLen: name.length,
    plusTestLocal: email ? isSequenceTestEmail(email) : false,
    VERCEL: Boolean(process.env.VERCEL),
    hasDATABASE_URL: Boolean(process.env.DATABASE_URL),
  });

  if (!isLikelyEmail(email)) {
    console.warn("[email-sequence] Bỏ qua chuỗi email — email không hợp lệ hoặc trống.");
    return;
  }

  logResendKeyStatus("before sequence");
  const keyMeta = describeApiKeyResolution();
  const apiKey = keyMeta.key;
  const from = String(process.env.RESEND_FROM_EMAIL || "").trim();

  console.log("[email-sequence] điều kiện gửi", {
    apiKeySource: keyMeta.source,
    apiKeyMasked: keyMeta.detail,
    RESEND_FROM_EMAIL: from || "(thiếu)",
  });

  if (!apiKey || !from) {
    console.warn(
      "[email-sequence] STOP — không gửi được: thiếu RESEND_API_KEY (env không có và/hoặc file không có key) HOẶC thiếu RESEND_FROM_EMAIL. Trên Vercel: Dashboard → Env → RESEND_API_KEY + RESEND_FROM_EMAIL."
    );
    return;
  }

  try {
    const testMode = isSequenceTestEmail(email);
    console.log("[email-sequence] testMode (+test trong local-part):", testMode);

    await sendSequenceStep(apiKey, from, email, name, 1);

    if (testMode) {
      await sendSequenceStep(apiKey, from, email, name, 2);
      await sendSequenceStep(apiKey, from, email, name, 3);
      console.log("[email-sequence] Test mode (+test): đã gửi xong 3 bước →", email);
      return;
    }

    if (storage.sqlite) {
      enqueueSequenceSqlite(storage.sqlite, email, name);
    } else if (storage.postgresMutate) {
      await storage.postgresMutate((snap) => {
        enqueueSequencePostgres(snap, email, name);
      });
    }
  } catch (e) {
    console.error("[email-sequence] runWaitlistSignupSequence lỗi:", e?.message || e);
    if (process.env.RESEND_MAIL_LOG === "1" || process.env.RESEND_MAIL_LOG === "true") {
      console.error(e?.stack || e);
    }
  }
}

/**
 * Cron: SQLite
 */
async function processDueJobsSqlite(db) {
  const apiKey = loadResendApiKey();
  const from = String(process.env.RESEND_FROM_EMAIL || "").trim();
  if (!apiKey || !from) return 0;

  const rows = db
    .prepare(
      `SELECT id, to_email, to_name, step FROM email_sequence_jobs
       WHERE sent_at IS NULL AND send_at <= datetime('now')
       ORDER BY id ASC`
    )
    .all();
  const jobs = rows.slice(0, MAX_JOBS_PER_RUN);
  console.log("[email-sequence cron] sqlite jobs", {
    due: rows.length,
    processing: jobs.length,
    maxPerRun: MAX_JOBS_PER_RUN,
  });

  let n = 0;
  const mark = db.prepare("UPDATE email_sequence_jobs SET sent_at = datetime('now') WHERE id = ?");

  for (const row of jobs) {
    try {
      await sendSequenceStep(apiKey, from, row.to_email, row.to_name || "", Number(row.step));
      mark.run(row.id);
      n++;
    } catch (e) {
      console.error("[email-sequence cron] job", row.id, e.message || e);
    }
  }
  return n;
}

/**
 * Cron: Postgres snapshot
 */
async function processDueJobsPostgres(mutate) {
  const apiKey = loadResendApiKey();
  const fromEmail = String(process.env.RESEND_FROM_EMAIL || "").trim();
  if (!apiKey || !fromEmail) return 0;

  let processed = 0;
  await mutate(async (snap) => {
    if (!Array.isArray(snap.email_sequence_jobs)) snap.email_sequence_jobs = [];
    const now = sqliteUtcFromMs(Date.now());
    const due = snap.email_sequence_jobs.filter(
      (j) => !j.sent_at && String(j.send_at || "") <= now
    );
    const jobs = due.slice(0, MAX_JOBS_PER_RUN);
    console.log("[email-sequence cron] postgres jobs", {
      due: due.length,
      processing: jobs.length,
      maxPerRun: MAX_JOBS_PER_RUN,
    });
    for (const j of jobs) {
      try {
        await sendSequenceStep(apiKey, fromEmail, j.to_email, j.to_name || "", Number(j.step));
        j.sent_at = sqliteUtcFromMs(Date.now());
        processed++;
      } catch (e) {
        console.error("[email-sequence cron] pg job", j.id, e.message || e);
      }
    }
  });
  return processed;
}

function cronEmailSequenceUnauthorized(req, url) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) return { ok: false, reason: "no_secret" };
  const auth = (req.headers.authorization || "").trim();
  const q = url.searchParams.get("secret");
  if (auth !== `Bearer ${secret}` && q !== secret) return { ok: false, reason: "bad_auth" };
  return { ok: true };
}

module.exports = {
  paymentPageUrl,
  isSequenceTestEmail,
  runWaitlistSignupSequence,
  processDueJobsSqlite,
  processDueJobsPostgres,
  cronEmailSequenceUnauthorized,
};
