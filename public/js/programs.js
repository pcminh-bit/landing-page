(function () {
  const CATEGORIES = ["kinh-doanh", "giao-duc", "cong-nghe", "tam-ly"];
  const LOADING_HTML =
    '<p class="program-cards-status">Đang tải chương trình...</p>';
  const ERROR_HTML =
    '<p class="program-cards-status program-cards-status--error">Không thể tải dữ liệu. Vui lòng thử lại.</p>';

  let currentBrochureUrl = null;
  let currentProgramSlug = null;
  let currentProgramTitle = null;

  const tabs = document.querySelectorAll(".program-tab");
  const panels = document.querySelectorAll(".program-panel");

  /** Logo files copied from logo/ → public/assets/logos/ (see scripts/copy-program-logos.js) */
  const LOGO_BY_SLUG = {
    ggu: "/assets/logos/ggu.png",
    edgewood: "/assets/logos/edgewood.png",
    esgci: "/assets/logos/esgci.webp",
    ljmu: "/assets/logos/ljmu.png",
    "ljmu-iiitb": "/assets/logos/ljmu.png",
    neu: "/assets/logos/neu.webp",
    uml: "/assets/logos/uml.png",
    opj: "/assets/logos/opj.svg",
  };

  function getLogoSrc(slug) {
    return LOGO_BY_SLUG[slug] || null;
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function jsArg(value) {
    return JSON.stringify(String(value ?? ""));
  }

  function openBrochureModal(brochureUrl, programSlug, programTitle) {
    currentBrochureUrl = brochureUrl;
    currentProgramSlug = programSlug;
    currentProgramTitle = programTitle;

    const modal = document.getElementById("brochureModal");
    const form = document.getElementById("brochureForm");
    const msgEl = document.getElementById("brochureFormMsg");
    const submitBtn = form?.querySelector(".modal-submit");

    document.getElementById("modalProgramName").textContent = programTitle;
    form.style.display = "flex";
    form.reset();
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Tải Brochure ngay →";
    }
    msgEl.style.display = "none";
    msgEl.textContent = "";
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeBrochureModal() {
    document.getElementById("brochureModal").style.display = "none";
    document.body.style.overflow = "";
    currentBrochureUrl = null;
    currentProgramSlug = null;
    currentProgramTitle = null;
  }

  window.openBrochureModal = openBrochureModal;
  window.closeBrochureModal = closeBrochureModal;

  function renderCard(p) {
    const brochureBtn = p.brochure_url
      ? `<button type="button" class="btn btn-outline program-cta-v2" onclick="openBrochureModal(${jsArg(p.brochure_url)}, ${jsArg(p.program_slug)}, ${jsArg(p.program_title)})">Tải Brochure</button>`
      : "";
    const logoSrc = getLogoSrc(p.university_slug);
    const headerMedia = logoSrc
      ? `<img class="program-uni-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(p.university_name)}" width="200" height="80" loading="lazy" />`
      : `<div class="program-uni-badge"><span class="program-uni-name">${escapeHtml(p.university_name)}</span></div>`;
    return `
    <div class="program-card-v2">
      <div class="program-card-img">
        <span class="program-accreditation">${escapeHtml(p.accreditation_label)}</span>
        ${headerMedia}
      </div>
      <div class="program-card-body">
        <span class="badge badge-primary">${escapeHtml(p.degree_badge)}</span>
        <h3 class="program-card-title">${escapeHtml(p.program_title)}</h3>
        <div class="program-card-meta">
          <span>🎓 ${escapeHtml(p.meta_line_1)}</span>
          <span>📅 ${escapeHtml(p.meta_line_2)}</span>
          <span>⭐ ${escapeHtml(p.meta_line_3)}</span>
        </div>
        <div class="program-card-pricing">
          <span class="price-label">${escapeHtml(p.price_after_text)}</span>
          <span class="price-after">${escapeHtml(p.price_display)}</span>
        </div>
        <div class="program-card-actions">
          <a href="${escapeHtml(p.cta_primary_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary program-cta-v2">${escapeHtml(p.cta_primary_label)}</a>
          ${brochureBtn}
        </div>
      </div>
    </div>
  `;
  }

  function setPanelContent(category, html) {
    const row = document.getElementById(`cards-${category}`);
    if (row) row.innerHTML = html;
  }

  function initTabs() {
    if (!tabs.length || !panels.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-tab");
        if (!target) return;

        tabs.forEach((t) => t.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));

        tab.classList.add("active");
        const panel = document.querySelector(
          `.program-panel[data-panel="${target}"]`
        );
        if (panel) panel.classList.add("active");
      });
    });
  }

  function initBrochureModal() {
    const modal = document.getElementById("brochureModal");
    const form = document.getElementById("brochureForm");
    if (!modal || !form) return;

    document.getElementById("modalClose").addEventListener("click", closeBrochureModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeBrochureModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") {
        closeBrochureModal();
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("brochureName").value.trim();
      const phone = document.getElementById("brochurePhone").value.trim();
      const submitBtn = form.querySelector(".modal-submit");
      const msgEl = document.getElementById("brochureFormMsg");

      if (!name || !phone) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "Đang xử lý...";

      try {
        await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone,
            source: "brochure-" + currentProgramSlug,
            program: currentProgramTitle,
          }),
        });
        window.open(currentBrochureUrl, "_blank", "noopener,noreferrer");
        form.style.display = "none";
        msgEl.style.display = "block";
        msgEl.style.color = "#16a34a";
        msgEl.style.background = "#f0fdf4";
        msgEl.style.padding = "12px";
        msgEl.style.borderRadius = "6px";
        msgEl.textContent =
          "✓ Brochure đã mở. Đội ngũ tư vấn sẽ liên hệ bạn sớm qua Zalo.";
        setTimeout(closeBrochureModal, 3000);
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = "Tải Brochure ngay →";
        msgEl.style.display = "block";
        msgEl.style.color = "var(--primary)";
        msgEl.style.background = "";
        msgEl.style.padding = "12px";
        msgEl.style.borderRadius = "6px";
        msgEl.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
      }
    });
  }

  function groupByCategory(programs) {
    const grouped = {};
    for (const cat of CATEGORIES) {
      grouped[cat] = [];
    }
    for (const p of programs) {
      const cat = p.category_slug;
      if (grouped[cat]) grouped[cat].push(p);
    }
    for (const cat of CATEGORIES) {
      grouped[cat].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
    }
    return grouped;
  }

  async function loadPrograms() {
    CATEGORIES.forEach((cat) => setPanelContent(cat, LOADING_HTML));

    try {
      const res = await fetch("/api/programs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const programs = await res.json();
      if (!Array.isArray(programs)) throw new Error("Invalid response");

      const grouped = groupByCategory(programs);

      for (const cat of CATEGORIES) {
        const list = grouped[cat];
        const html = list.length
          ? list.map((p) => renderCard(p)).join("")
          : '<p class="program-cards-status">Chưa có chương trình trong mục này.</p>';
        setPanelContent(cat, html);
      }
    } catch {
      CATEGORIES.forEach((cat) => setPanelContent(cat, ERROR_HTML));
    }
  }

  initTabs();
  initBrochureModal();
  loadPrograms();
})();
