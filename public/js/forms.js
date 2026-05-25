(function () {
  const form = document.getElementById('heroForm');
  const msgEl = document.getElementById('heroFormMsg');
  if (!form || !msgEl) return;

  const submitBtn = form.querySelector('.hero-submit');
  const defaultBtnText = submitBtn?.textContent || 'Nhận học bổng tốt nhất →';

  function showMessage(text, isError) {
    msgEl.textContent = text;
    msgEl.style.display = 'block';
    msgEl.style.color = isError ? 'var(--primary)' : '#16a34a';
    msgEl.style.fontWeight = '500';
    msgEl.style.marginTop = '12px';
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Đang gửi...' : defaultBtnText;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = String(form.querySelector('#heroName')?.value || '').trim();
    const phone = String(form.querySelector('#heroPhone')?.value || '').trim();
    const email = String(form.querySelector('#heroEmail')?.value || '').trim();

    if (!name || !phone) {
      showMessage('Vui lòng nhập họ tên và số điện thoại.', true);
      return;
    }

    msgEl.style.display = 'none';
    setLoading(true);

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, source: 'hero-form' }),
      });

      const data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      showMessage(
        '✓ Đã nhận thông tin. Đội ngũ của tôi sẽ liên hệ trong 24h qua Zalo hoặc điện thoại.',
        false
      );
      form.style.display = 'none';
    } catch {
      showMessage(
        'Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ qua Zalo.',
        true
      );
    } finally {
      setLoading(false);
    }
  });
})();
