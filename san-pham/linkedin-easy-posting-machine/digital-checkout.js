(function (global) {
  const SLUG = "linkedin-easy-posting-machine";

  function qs(name) {
    return new URLSearchParams(global.location.search).get(name);
  }

  function formatVnd(n) {
    return Number(n).toLocaleString("vi-VN") + " VND";
  }

  async function fetchProduct() {
    const res = await fetch("/api/digital-products/" + SLUG);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Không tải được sản phẩm.");
    return data;
  }

  async function createDigitalOrder(payload) {
    const res = await fetch("/api/digital-payment-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SLUG, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Không tạo được đơn.");
    return data;
  }

  async function pollOrderStatus(orderCode, onSuccess, onTick) {
    let timer = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const tick = async () => {
      try {
        const q = encodeURIComponent(orderCode);
        const res = await fetch("/api/payment-orders/status?order_code=" + q);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (typeof onTick === "function") onTick(data);
        if (data.status === "success") {
          stop();
          onSuccess(data);
        }
      } catch (_) {
        /* ignore */
      }
    };
    timer = setInterval(tick, 2500);
    tick();
    return stop;
  }

  global.DigitalCheckout = {
    SLUG,
    qs,
    formatVnd,
    fetchProduct,
    createDigitalOrder,
    pollOrderStatus,
  };
})(window);
