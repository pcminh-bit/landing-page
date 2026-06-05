 (function () {
  const state = {
    referrers: [],
    referees: [],
    programs: [],
    activeReferrerCode: null,
  };

  const tabs = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = {
    referrers: document.getElementById("referrers-panel"),
    referees: document.getElementById("referees-panel"),
  };

  const basicRefereeInputs = [
    document.getElementById("rf_referrer_code"),
    document.getElementById("rf_name"),
    document.getElementById("rf_phone"),
    document.getElementById("rf_email"),
  ];

  const enrolledProgramEl = document.getElementById("rf_enrolled_program");
  const tuitionAmountEl = document.getElementById("rf_tuition_amount");
  const feeWaiverEl = document.getElementById("rf_fee_waiver");
  const netTuitionEl = document.getElementById("rf_net_tuition");
  const commissionRateEl = document.getElementById("rf_commission_rate");
  const commissionAmountEl = document.getElementById("rf_commission_amount");
  const financialPlanEl = document.getElementById("rf_financial_plan");
  const installmentCountEl = document.getElementById("rf_installment_count");
  const installmentCountGroupEl = document.getElementById("installmentCountGroup");
  const upfrontAmountEl = document.getElementById("rf_upfront_amount");
  const upfrontAmountGroupEl = document.getElementById("upfrontAmountGroup");
  const enrollmentSectionEl = document.getElementById("enrollmentSection");
  const installmentsWrapEl = document.getElementById("installmentsTableWrap");
  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Yeu cau that bai");
    return payload;
  }

  function parseNumber(value, fallback = 0) {
    const n = Number(String(value ?? "").trim());
    return Number.isFinite(n) ? n : fallback;
  }

  function parseRate(value, fallback = 0.05) {
    const n = Number(String(value ?? "").trim().replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }

  function parseMoney(value, fallback = 0) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return fallback;
    const n = Number(digits);
    return Number.isFinite(n) ? n : fallback;
  }

  function formatComma(n) {
    return Number(n || 0).toLocaleString("vi-VN");
  }

  function setMoneyInput(el, amount) {
    if (!el) return;
    el.value = formatComma(amount);
  }

  function getMoneyInput(el) {
    return parseMoney(el?.value, 0);
  }

  function formatVND(n) {
    return formatComma(n) + " VNĐ";
  }

  function bindMoneyInput(el, onChange) {
    if (!el) return;
    el.addEventListener("focus", () => {
      const n = getMoneyInput(el);
      el.value = n > 0 ? String(n) : "";
    });
    el.addEventListener("blur", () => {
      const n = getMoneyInput(el);
      setMoneyInput(el, n);
      if (onChange) onChange();
    });
    el.addEventListener("input", () => {
      if (onChange) onChange();
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("vi-VN");
  }

  function monthYearFromDate(date) {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${mm}/${date.getFullYear()}`;
  }

  function addMonthYear(baseDate, delta) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + delta, 1);
    return monthYearFromDate(d);
  }

  function getReferrerStatusBadge(status) {
    return String(status || "active").toLowerCase() === "inactive"
      ? '<span class="badge status-inactive">inactive</span>'
      : '<span class="badge status-active">active</span>';
  }

  function getRefereeStatusBadge(status) {
    const normalized = String(status || "pending").trim().toLowerCase();
    const allowed = ["pending", "contacted", "enrolled", "commission_paid"];
    const key = allowed.includes(normalized) ? normalized : "pending";
    return `<span class="badge status-${key}">${escapeHtml(key)}</span>`;
  }

  function enrollmentReady() {
    return basicRefereeInputs.every((el) => String(el.value || "").trim() !== "");
  }

  function refreshEnrollmentVisibility() {
    enrollmentSectionEl.hidden = !enrollmentReady();
  }

  function recalcNetFromTuitionAndWaiver() {
    const tuition = getMoneyInput(tuitionAmountEl);
    const feeWaiver = getMoneyInput(feeWaiverEl);
    setMoneyInput(netTuitionEl, Math.max(0, tuition - feeWaiver));
  }

  function recalcCommission() {
    const netTuition = getMoneyInput(netTuitionEl);
    const rate = parseRate(commissionRateEl.value, 0.05);
    setMoneyInput(commissionAmountEl, Math.round(netTuition * rate));
  }

  function recalcInstallmentCommissions() {
    const rate = parseRate(commissionRateEl.value, 0.05);
    installmentsWrapEl.querySelectorAll(".inst-amount").forEach((amountEl) => {
      const idx = amountEl.dataset.index;
      const comEl = installmentsWrapEl.querySelector(
        `.inst-commission[data-index="${idx}"]`
      );
      if (comEl) {
        const amount = getMoneyInput(amountEl);
        comEl.value = formatComma(Math.round(amount * rate));
      }
    });
  }

  function splitEvenly(total, parts) {
    const amounts = [];
    const base = Math.floor(total / parts);
    for (let i = 1; i <= parts; i += 1) {
      amounts.push(i === parts ? total - base * (parts - 1) : base);
    }
    return amounts;
  }

  function buildInstallmentRow(i, amount, dueMonthOffset, rate, rowIndex) {
    const now = new Date();
    const dueDate = addMonthYear(now, dueMonthOffset);
    const commissionDueDate = addMonthYear(now, dueMonthOffset + 2);
    return `
      <tr>
        <td>${i}</td>
        <td><input type="text" class="inst-amount money-input" value="${formatComma(amount)}" data-index="${rowIndex}" inputmode="numeric" /></td>
        <td><input type="text" class="inst-due" value="${dueDate}" data-index="${rowIndex}" placeholder="MM/YYYY" /></td>
        <td><input type="text" class="inst-commission" value="${formatComma(Math.round(amount * rate))}" data-index="${rowIndex}" readonly /></td>
        <td><input type="text" class="inst-com-due" value="${commissionDueDate}" data-index="${rowIndex}" placeholder="MM/YYYY" /></td>
      </tr>
    `;
  }

  function updatePlanFieldsVisibility() {
    const plan = financialPlanEl.value;
    installmentCountGroupEl.hidden = plan === "full";
    upfrontAmountGroupEl.hidden = plan !== "partial_installment";
  }

  function generateInstallments() {
    const plan = financialPlanEl.value;
    updatePlanFieldsVisibility();
    const netTuition = Math.max(0, getMoneyInput(netTuitionEl));
    const rate = parseRate(commissionRateEl.value, 0.05);
    const rows = [];
    let rowIndex = 0;

    if (plan === "full") {
      rows.push(buildInstallmentRow(1, netTuition, 1, rate, rowIndex++));
    } else if (plan === "installment") {
      const count = Math.min(6, Math.max(2, parseNumber(installmentCountEl.value, 2)));
      const amounts = splitEvenly(netTuition, count);
      amounts.forEach((amount, idx) => {
        rows.push(buildInstallmentRow(idx + 1, amount, 1 + idx * 2, rate, rowIndex++));
      });
    } else if (plan === "partial_installment") {
      const installmentCount = Math.min(6, Math.max(2, parseNumber(installmentCountEl.value, 2)));
      let upfront = getMoneyInput(upfrontAmountEl);
      if (!upfront || upfront >= netTuition) {
        upfront = Math.round(netTuition * 0.3);
        setMoneyInput(upfrontAmountEl, upfront);
      }
      const remaining = Math.max(0, netTuition - upfront);
      rows.push(buildInstallmentRow("Trả trước", upfront, 1, rate, rowIndex++));
      const amounts = splitEvenly(remaining, installmentCount);
      amounts.forEach((amount, idx) => {
        rows.push(buildInstallmentRow(idx + 1, amount, 3 + idx * 2, rate, rowIndex++));
      });
    }

    installmentsWrapEl.innerHTML = rows.length
      ? `
      <table id="installmentsTable" class="installments-table compact">
        <thead>
          <tr>
            <th>Đợt</th><th>Số tiền (VNĐ)</th><th>Tháng đóng học phí (MM/YYYY)</th><th>Com từng đợt</th><th>Tháng trả hoa hồng (MM/YYYY)</th>
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    `
      : "";

    installmentsWrapEl.querySelectorAll(".inst-amount").forEach((el) => {
      bindMoneyInput(el, recalcInstallmentCommissions);
    });
  }

  function collectInstallmentsFromForm() {
    const amountNodes = Array.from(installmentsWrapEl.querySelectorAll(".inst-amount"));
    const dueNodes = Array.from(installmentsWrapEl.querySelectorAll(".inst-due"));
    const comNodes = Array.from(installmentsWrapEl.querySelectorAll(".inst-commission"));
    const comDueNodes = Array.from(installmentsWrapEl.querySelectorAll(".inst-com-due"));
    return amountNodes.map((node, idx) => ({
      installment_no: idx + 1,
      amount: getMoneyInput(node),
      due_date: String(dueNodes[idx]?.value || "").trim(),
      commission_amount: parseMoney(comNodes[idx]?.value, 0),
      commission_due_date: String(comDueNodes[idx]?.value || "").trim(),
      commission_paid: false,
    }));
  }

  function populateReferrerCodeSelect(preselectedCode = null) {
    const el = document.getElementById("rf_referrer_code");
    if (!el) return;
    const selected =
      preselectedCode || state.activeReferrerCode || String(el.value || "").trim();
    const activeReferrers = state.referrers.filter(
      (r) => String(r.status || "active").trim().toLowerCase() === "active"
    );
    const options = [
      '<option value="">— Chọn mã referral —</option>',
      ...activeReferrers.map((r) => {
        const code = String(r.referral_code || "").trim();
        const label = `${code} — ${r.name || ""}`;
        const isSelected = code === selected ? " selected" : "";
        return `<option value="${escapeHtml(code)}"${isSelected}>${escapeHtml(label)}</option>`;
      }),
    ];
    el.innerHTML = options.join("");
    if (selected && !el.value) {
      el.value = selected;
    }
    refreshEnrollmentVisibility();
  }

  async function loadPrograms() {
    const data = await api("/api/programs");
    state.programs = Array.isArray(data) ? data : [];
    const options = [
      '<option value="">Chọn chương trình</option>',
      ...state.programs.map((p) => {
        const label = `${p.program_title || p.program_slug} — ${p.university_name || ""}`;
        return `<option value="${escapeHtml(p.program_slug)}" data-price="${Number(p.price_after || 0)}">${escapeHtml(label)}</option>`;
      }),
    ];
    enrolledProgramEl.innerHTML = options.join("");
  }

  function renderReferrers() {
    const wrap = document.getElementById("referrers-table-wrap");
    if (!state.referrers.length) {
      wrap.innerHTML = '<div class="empty">Chua co referrer.</div>';
      return;
    }
    const rows = state.referrers
      .map(
        (item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.name || "")}</td>
          <td>${escapeHtml(item.phone || "")}</td>
          <td>${escapeHtml(item.email || "")}</td>
          <td><span class="mono">${escapeHtml(item.referral_code || "")}</span></td>
          <td><span class="badge badge-count">${Number(item.referee_count || 0)}</span></td>
          <td>${getReferrerStatusBadge(item.status)}</td>
          <td>${escapeHtml(item.bank_name || "")}</td>
          <td>
            <div class="actions">
              <button class="action" data-view-referees="${escapeHtml(item.referral_code)}">Xem</button>
              <button class="action ${String(item.status || "active") === "active" ? "danger" : "ok"}" data-toggle-referrer="${escapeHtml(item.referral_code)}" data-current-status="${escapeHtml(item.status || "active")}">
                ${String(item.status || "active") === "active" ? "Đổi inactive" : "Đổi active"}
              </button>
              <button type="button" class="action" data-delete-referrer="${escapeHtml(item.referral_code)}" style="background:#dc2626;color:white;border-radius:4px;padding:6px 12px;font-size:13px;">Xóa</button>
            </div>
          </td>
        </tr>`
      )
      .join("");
    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>STT</th><th>Họ tên</th><th>SĐT</th><th>Email</th><th>Mã referral</th><th>Số referee</th><th>Trạng thái</th><th>Ngân hàng</th><th>Hành động</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    wrap.querySelectorAll("[data-view-referees]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeReferrerCode = btn.dataset.viewReferees;
        populateReferrerCodeSelect(state.activeReferrerCode);
        document.querySelector('[data-tab="referees"]')?.click();
      });
    });
    wrap.querySelectorAll("[data-toggle-referrer]").forEach((btn) => {
      btn.addEventListener("click", () =>
        toggleReferrerStatus(btn.dataset.toggleReferrer, btn.dataset.currentStatus).catch((error) =>
          alert(error.message)
        )
      );
    });
    wrap.querySelectorAll("[data-delete-referrer]").forEach((btn) => {
      btn.addEventListener("click", () => deleteReferrer(btn.dataset.deleteReferrer));
    });
  }

  function parseInstallments(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function programDisplayName(slugOrName) {
    const raw = String(slugOrName || "").trim();
    if (!raw) return "";
    const program = state.programs.find((p) => p.program_slug === raw);
    if (!program) return raw;
    const title = program.program_title || raw;
    const uni = program.university_name || "";
    return uni ? `${title} — ${uni}` : title;
  }

  function planLabel(item) {
    const plan = String(item.financial_plan || "full");
    const list = parseInstallments(item.installments);
    if (plan === "installment") return `Trả góp ${list.length || 0} đợt`;
    if (plan === "partial_installment") {
      const gopCount = Math.max(0, (list.length || 0) - 1);
      return `Trả trước + góp ${gopCount} đợt`;
    }
    return "Thanh toán full";
  }

  function renderReferees() {
    const wrap = document.getElementById("referees-table-wrap");
    if (!state.referees.length) {
      wrap.innerHTML = '<div class="empty">Chua co referee.</div>';
      return;
    }
    const rows = state.referees
      .map(
        (item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.phone || "")}</td>
          <td>${escapeHtml(item.email || "")}</td>
          <td>${escapeHtml(programDisplayName(item.enrolled_program || item.program_interest))}</td>
          <td>${formatVND(Number(item.tuition_amount || 0) - Number(item.fee_waiver || 0))}</td>
          <td>${planLabel(item)}</td>
          <td>${formatVND(item.commission_amount || 0)}</td>
          <td>${getRefereeStatusBadge(item.status)}</td>
          <td>${formatDate(item.created_at)}</td>
          <td>
            <div class="actions">
              <button class="action" data-details-referee="${item.id}">Chi tiết</button>
              <button class="action" data-edit-referee="${item.id}">Cập nhật</button>
              <button type="button" class="action" data-delete-referee="${item.id}" style="background:#dc2626;color:white;border-radius:4px;padding:6px 12px;font-size:13px;">Xóa</button>
            </div>
          </td>
        </tr>
        <tr class="expand-row" id="referee-detail-row-${item.id}" style="display:none;">
          <td colspan="11">
            ${renderInstallmentsDetail(item)}
          </td>
        </tr>
        <tr class="inline-edit" id="referee-edit-row-${item.id}" style="display:none;">
          <td colspan="11">
            <form data-referee-form="${item.id}" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;align-items:end;">
              <label>Status
                <select name="status">
                  <option value="pending" ${item.status === "pending" ? "selected" : ""}>pending</option>
                  <option value="contacted" ${item.status === "contacted" ? "selected" : ""}>contacted</option>
                  <option value="enrolled" ${item.status === "enrolled" ? "selected" : ""}>enrolled</option>
                  <option value="commission_paid" ${item.status === "commission_paid" ? "selected" : ""}>commission_paid</option>
                </select>
              </label>
              <label>Enrolled program<input name="enrolled_program" value="${escapeHtml(item.enrolled_program || "")}" /></label>
              <label>Tuition amount<input name="tuition_amount" type="number" value="${escapeHtml(item.tuition_amount || "")}" /></label>
              <label>Fee waiver<input name="fee_waiver" type="number" value="${escapeHtml(item.fee_waiver || 0)}" /></label>
              <label>Commission rate<input name="commission_rate" type="number" step="0.01" value="${escapeHtml(item.commission_rate || "")}" /></label>
              <label>Commission amount<input name="commission_amount" type="number" value="${escapeHtml(item.commission_amount || "")}" /></label>
              <label>Financial plan
                <select name="financial_plan">
                  <option value="full" ${item.financial_plan === "full" ? "selected" : ""}>full</option>
                  <option value="installment" ${item.financial_plan === "installment" ? "selected" : ""}>installment</option>
                  <option value="partial_installment" ${item.financial_plan === "partial_installment" ? "selected" : ""}>partial_installment</option>
                </select>
              </label>
              <label>Commission note<input name="commission_note" value="${escapeHtml(item.commission_note || "")}" /></label>
              <label>Payment schedule<input name="payment_schedule" value="${escapeHtml(item.payment_schedule || "")}" /></label>
              <label style="grid-column: span 3;">Installments (JSON)<textarea rows="3" name="installments">${escapeHtml(item.installments || "")}</textarea></label>
              <button type="submit" class="action ok">Lưu cập nhật</button>
            </form>
          </td>
        </tr>`
      )
      .join("");
    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>STT</th><th>Học viên</th><th>SĐT</th><th>Email</th><th>Chương trình</th><th>Net tuition</th><th>Hình thức</th><th>Tổng com</th><th>Status</th><th>Ngày tạo</th><th>Hành động</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    wrap.querySelectorAll("[data-details-referee]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = document.getElementById(`referee-detail-row-${btn.dataset.detailsReferee}`);
        if (!row) return;
        row.style.display = row.style.display === "none" ? "table-row" : "none";
      });
    });
    wrap.querySelectorAll("[data-edit-referee]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = document.getElementById(`referee-edit-row-${btn.dataset.editReferee}`);
        if (!row) return;
        row.style.display = row.style.display === "none" ? "table-row" : "none";
      });
    });
    wrap.querySelectorAll("[data-delete-referee]").forEach((btn) => {
      btn.addEventListener("click", () => deleteReferee(Number(btn.dataset.deleteReferee)));
    });
    wrap.querySelectorAll("[data-referee-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const id = Number(form.dataset.refereeForm);
        const formData = new FormData(form);
        const payload = {
          status: String(formData.get("status") || "").trim(),
          enrolled_program: String(formData.get("enrolled_program") || "").trim(),
          tuition_amount: formData.get("tuition_amount") || null,
          commission_rate: formData.get("commission_rate") || null,
          commission_amount: formData.get("commission_amount") || null,
          fee_waiver: formData.get("fee_waiver") || null,
          financial_plan: String(formData.get("financial_plan") || "full"),
          installments: String(formData.get("installments") || "").trim(),
          commission_note: String(formData.get("commission_note") || "").trim(),
          payment_schedule: String(formData.get("payment_schedule") || "").trim(),
        };
        if (payload.tuition_amount !== null && payload.tuition_amount !== "") {
          payload.tuition_amount = Number(payload.tuition_amount);
        } else {
          delete payload.tuition_amount;
        }
        if (payload.commission_rate !== null && payload.commission_rate !== "") {
          payload.commission_rate = Number(payload.commission_rate);
        } else {
          delete payload.commission_rate;
        }
        if (payload.commission_amount !== null && payload.commission_amount !== "") {
          payload.commission_amount = Number(payload.commission_amount);
        } else {
          delete payload.commission_amount;
        }
        if (payload.fee_waiver !== null && payload.fee_waiver !== "") {
          payload.fee_waiver = Number(payload.fee_waiver);
        } else {
          delete payload.fee_waiver;
        }
        if (!payload.installments) delete payload.installments;
        if (!payload.enrolled_program) delete payload.enrolled_program;
        if (!payload.commission_note) delete payload.commission_note;
        if (!payload.payment_schedule) delete payload.payment_schedule;
        updateReferee(id, payload).catch((error) => alert(error.message));
      });
    });
  }

  async function loadReferrers() {
    const data = await api("/api/referrers");
    state.referrers = Array.isArray(data) ? data : [];
    renderReferrers();
    populateReferrerCodeSelect();
  }

  async function loadReferees(referrerCode = null) {
    const code = referrerCode || "";
    const url = code
      ? `/api/referees?referrer_code=${encodeURIComponent(code)}`
      : "/api/referees";
    const data = await api(url);
    state.referees = Array.isArray(data) ? data : [];
    renderReferees();
  }

  async function toggleReferrerStatus(code, currentStatus) {
    const nextStatus = String(currentStatus || "").trim() === "active" ? "inactive" : "active";
    await api(`/api/referrers/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadReferrers();
  }

  async function deleteReferrer(code) {
    const confirmed = confirm("Xóa referrer này? Hành động không thể hoàn tác.");
    if (!confirmed) return;
    try {
      await api(`/api/referrers/${encodeURIComponent(code)}`, { method: "DELETE" });
      await loadReferrers();
    } catch (error) {
      alert(error.message);
    }
  }

  async function updateReferee(id, data) {
    await api(`/api/referees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    await loadReferees(state.activeReferrerCode);
  }

  async function deleteReferee(id) {
    const confirmed = confirm("Xóa referee này? Hành động không thể hoàn tác.");
    if (!confirmed) return;
    try {
      await api(`/api/referees/${id}`, { method: "DELETE" });
      await loadReferees(state.activeReferrerCode);
      await loadReferrers();
    } catch (error) {
      alert(error.message);
    }
  }

  function renderInstallmentsDetail(item) {
    const installments = parseInstallments(item.installments);
    if (!installments.length) {
      return '<div class="empty">Chua co du lieu installments.</div>';
    }
    const rows = installments
      .map(
        (ins, idx) => `
      <tr>
        <td>${ins.installment_no || idx + 1}</td>
        <td>${formatVND(ins.amount || 0)}</td>
        <td>${escapeHtml(ins.due_date || "")}</td>
        <td>${formatVND(ins.commission_amount || 0)}</td>
        <td>${escapeHtml(ins.commission_due_date || "")}</td>
        <td>
          <label class="paid-check">
            <input type="checkbox" data-referee-id="${item.id}" data-installment-index="${idx}" ${ins.commission_paid ? "checked" : ""} />
            <span class="${ins.commission_paid ? "paid-badge" : ""}">${ins.commission_paid ? "Đã trả" : "Chưa trả"}</span>
          </label>
        </td>
      </tr>`
      )
      .join("");
    return `
      <div class="expand-content">
        <table class="installments-table compact">
          <thead>
            <tr>
              <th>Đợt</th><th>Số tiền</th><th>Tháng đóng học phí</th><th>Com từng đợt</th><th>Tháng trả hoa hồng</th><th>Đã trả hoa hồng</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }
  document.getElementById("addReferrerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById("r_name").value,
      phone: document.getElementById("r_phone").value,
      email: document.getElementById("r_email").value,
      bank_name: document.getElementById("r_bank_name").value,
      bank_account: document.getElementById("r_bank_account").value,
      bank_holder: document.getElementById("r_bank_holder").value,
      notes: document.getElementById("r_notes").value,
    };
    const msg = document.getElementById("addReferrerMsg");
    try {
      const data = await api("/api/referrers", {
        method: "POST",
        body: JSON.stringify(body),
      });
      msg.textContent = `✓ Đã thêm. Mã: ${data.referral_code}`;
      msg.style.color = "green";
      e.target.reset();
      await loadReferrers();
    } catch (error) {
      msg.textContent = error.message;
      msg.style.color = "red";
    }
  });
  document.getElementById("addRefereeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const installments = collectInstallmentsFromForm();
    const tuitionAmount = getMoneyInput(tuitionAmountEl);
    const feeWaiver = getMoneyInput(feeWaiverEl);
    const body = {
      referrer_code: document.getElementById("rf_referrer_code").value,
      name: document.getElementById("rf_name").value,
      phone: document.getElementById("rf_phone").value,
      email: document.getElementById("rf_email").value,
      enrolled_program: enrolledProgramEl.value,
      tuition_amount: tuitionAmount,
      fee_waiver: feeWaiver,
      net_tuition: getMoneyInput(netTuitionEl),
      commission_rate: parseRate(commissionRateEl.value, 0.05),
      commission_amount: getMoneyInput(commissionAmountEl),
      financial_plan: financialPlanEl.value,
      installments: JSON.stringify(installments),
    };
    const msg = document.getElementById("addRefereeMsg");
    try {
      await api("/api/referees", {
        method: "POST",
        body: JSON.stringify(body),
      });
      msg.textContent = "✓ Đã thêm referee thành công";
      msg.style.color = "green";
      e.target.reset();
      populateReferrerCodeSelect();
      setMoneyInput(feeWaiverEl, 0);
      setMoneyInput(tuitionAmountEl, 0);
      setMoneyInput(netTuitionEl, 0);
      setMoneyInput(commissionAmountEl, 0);
      commissionRateEl.value = 0.05;
      installmentCountEl.value = 2;
      setMoneyInput(upfrontAmountEl, 0);
      financialPlanEl.value = "full";
      updatePlanFieldsVisibility();
      enrollmentSectionEl.hidden = true;
      installmentsWrapEl.innerHTML = "";
      await loadReferees(state.activeReferrerCode);
    } catch (error) {
      msg.textContent = error.message;
      msg.style.color = "red";
    }
  });

  tabs.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tab = btn.dataset.tab;
      tabs.forEach((item) => item.classList.toggle("active", item === btn));
      Object.entries(panels).forEach(([key, panel]) => {
        panel.classList.toggle("active", key === tab);
      });
      if (tab === "referrers") await loadReferrers();
      if (tab === "referees") {
        await loadReferrers();
        populateReferrerCodeSelect(state.activeReferrerCode);
        if (!state.programs.length) await loadPrograms();
        refreshEnrollmentVisibility();
        if (!enrollmentSectionEl.hidden) {
          recalcNetFromTuitionAndWaiver();
          recalcCommission();
          generateInstallments();
        }
        await loadReferees(state.activeReferrerCode);
      }
    });
  });

  basicRefereeInputs.forEach((input) => {
    const onBasicChange = () => {
      refreshEnrollmentVisibility();
      if (!enrollmentSectionEl.hidden && !installmentsWrapEl.innerHTML) {
        setMoneyInput(feeWaiverEl, getMoneyInput(feeWaiverEl));
        recalcNetFromTuitionAndWaiver();
        recalcCommission();
        generateInstallments();
      }
    };
    input.addEventListener("input", onBasicChange);
    if (input.tagName === "SELECT") {
      input.addEventListener("change", onBasicChange);
    }
  });
  bindMoneyInput(tuitionAmountEl, () => {
    recalcNetFromTuitionAndWaiver();
    recalcCommission();
    generateInstallments();
  });
  bindMoneyInput(feeWaiverEl, () => {
    recalcNetFromTuitionAndWaiver();
    recalcCommission();
    generateInstallments();
  });
  bindMoneyInput(netTuitionEl, () => {
    recalcCommission();
    generateInstallments();
  });
  bindMoneyInput(commissionAmountEl, () => {
    generateInstallments();
  });

  enrolledProgramEl.addEventListener("change", () => {
    const selected = state.programs.find((p) => p.program_slug === enrolledProgramEl.value);
    if (selected) setMoneyInput(tuitionAmountEl, Number(selected.price_after || 0));
    recalcNetFromTuitionAndWaiver();
    recalcCommission();
    generateInstallments();
  });
  commissionRateEl.addEventListener("input", () => {
    recalcCommission();
    generateInstallments();
  });
  bindMoneyInput(upfrontAmountEl, () => generateInstallments());
  financialPlanEl.addEventListener("change", () => generateInstallments());
  installmentCountEl.addEventListener("input", () => generateInstallments());

  document.getElementById("referees-table-wrap").addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.matches("[data-installment-index][data-referee-id]")) return;
    const refereeId = Number(input.dataset.refereeId);
    const idx = Number(input.dataset.installmentIndex);
    const row = state.referees.find((r) => Number(r.id) === refereeId);
    if (!row) return;
    const installments = parseInstallments(row.installments);
    if (!installments[idx]) return;
    installments[idx].commission_paid = input.checked;
    updateReferee(refereeId, { installments: JSON.stringify(installments) }).catch((error) =>
      alert(error.message)
    );
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });
      } finally {
        window.location.href = "/login";
      }
    });
  }

  Promise.all([loadReferrers(), loadReferees(), loadPrograms()]).catch((error) => {
    alert(`Khong tai duoc du lieu: ${error.message}`);
  });
})();
