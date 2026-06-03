async function submitLeadForm(formData, btnEl, msgEl, formEl) {
  btnEl.disabled = true;
  const originalText = btnEl.textContent;
  btnEl.textContent = "Đang gửi...";

  try {
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const data = await res.json();

    if (res.ok) {
      formEl.style.display = "none";
      msgEl.style.display = "block";
      msgEl.style.cssText =
        "display:block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;color:#166534;font-size:14px;line-height:1.6;";
      msgEl.textContent =
        "✓ Đã nhận thông tin. Đội ngũ của tôi sẽ liên hệ trong 24h qua Zalo hoặc điện thoại.";
    } else {
      btnEl.disabled = false;
      btnEl.textContent = originalText;
      msgEl.style.display = "block";
      msgEl.style.cssText = "display:block;padding:12px;color:#E50913;font-size:14px;";
      msgEl.textContent = data.error || "Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ Zalo.";
    }
  } catch (err) {
    btnEl.disabled = false;
    btnEl.textContent = originalText;
    msgEl.style.display = "block";
    msgEl.style.cssText = "display:block;padding:12px;color:#E50913;font-size:14px;";
    msgEl.textContent = "Có lỗi xảy ra. Vui lòng liên hệ Zalo 0917 500 437.";
  }
}

// Hero form
const heroForm = document.getElementById("heroForm");
if (heroForm) {
  heroForm.addEventListener("submit", function (e) {
    e.preventDefault();
    submitLeadForm(
      {
        name: document.getElementById("heroName").value.trim(),
        phone: document.getElementById("heroPhone").value.trim(),
        email: document.getElementById("heroEmail").value.trim(),
        source: "hero-form",
      },
      document.getElementById("heroSubmitBtn"),
      document.getElementById("heroFormMsg"),
      heroForm
    );
  });
}

// Consultation form
const consultForm = document.getElementById("consultForm");
if (consultForm) {
  consultForm.addEventListener("submit", function (e) {
    e.preventDefault();
    submitLeadForm(
      {
        name: document.getElementById("consultName").value.trim(),
        phone: document.getElementById("consultPhone").value.trim(),
        email: document.getElementById("consultEmail").value.trim(),
        program: document.getElementById("consultProgram").value,
        source: "consultation-form",
      },
      document.getElementById("consultSubmitBtn"),
      document.getElementById("consultFormMsg"),
      consultForm
    );
  });
}
