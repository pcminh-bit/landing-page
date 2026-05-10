(function () {
  const state = {
    products: [],
    customers: [],
    orders: [],
  };

  const tabs = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = {
    products: document.getElementById("products-panel"),
    customers: document.getElementById("customers-panel"),
    orders: document.getElementById("orders-panel"),
  };

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      tabs.forEach((item) => item.classList.toggle("active", item === btn));
      Object.entries(panels).forEach(([key, panel]) => {
        panel.classList.toggle("active", key === tab);
      });
    });
  });

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Yeu cau that bai");
    }
    return payload;
  }

  function renderStoreBanner(info) {
    const el = document.getElementById("store-banner");
    if (!el) return;
    if (info.vercel && !info.postgres) {
      el.hidden = false;
      el.textContent =
        "Cảnh báo: SQLite trên Vercel lưu trong /tmp theo từng instance serverless. Webhook và trang Admin có thể thấy hai bộ dữ liệu khác nhau — tab Đơn hàng có thể trống dù webhook trả 200 OK. Thêm DATABASE_URL (Neon Postgres) trong Environment Variables để dữ liệu webhook và admin dùng chung.";
    } else {
      el.hidden = true;
      el.textContent = "";
    }
  }

  async function loadAll() {
    let storeInfo = { vercel: false, postgres: false };
    try {
      const r = await fetch("/api/store-info");
      if (r.ok) storeInfo = await r.json();
    } catch (_) {}

    const [products, customers, orders] = await Promise.all([
      api("/api/products"),
      api("/api/customers"),
      api("/api/orders"),
    ]);
    state.products = Array.isArray(products) ? products : [];
    state.customers = Array.isArray(customers) ? customers : [];
    state.orders = Array.isArray(orders) ? orders : [];
    renderStoreBanner(storeInfo);
    renderProducts();
    renderCustomers();
    renderOrders();
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN");
  }

  function isOrderPending(status) {
    return String(status || "").trim().toLowerCase() === "pending";
  }

  function renderProducts() {
    const wrap = document.getElementById("products-table-wrap");
    if (!state.products.length) {
      wrap.innerHTML = '<div class="empty">Chua co san pham.</div>';
      return;
    }
    const rows = state.products
      .map(
        (item) => `
        <tr>
          <td>${item.id}</td>
          <td>${item.name}</td>
          <td>${formatMoney(item.price)}</td>
          <td>${item.description || ""}</td>
          <td>${item.stock_quantity}</td>
          <td>${item.created_at || ""}</td>
          <td>
            <div class="actions">
              <button class="action" data-edit-product="${item.id}">Sua</button>
              <button class="action danger" data-del-product="${item.id}">Xoa</button>
            </div>
          </td>
        </tr>`
      )
      .join("");

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Ten</th><th>Gia</th><th>Mo ta</th><th>Ton kho</th><th>Ngay tao</th><th>Hanh dong</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    wrap.querySelectorAll("[data-edit-product]").forEach((btn) => {
      btn.addEventListener("click", () => editProduct(Number(btn.dataset.editProduct)));
    });
    wrap.querySelectorAll("[data-del-product]").forEach((btn) => {
      btn.addEventListener("click", () => deleteProduct(Number(btn.dataset.delProduct)));
    });
  }

  function renderCustomers() {
    const wrap = document.getElementById("customers-table-wrap");
    if (!state.customers.length) {
      wrap.innerHTML = '<div class="empty">Chua co khach hang.</div>';
      return;
    }
    const rows = state.customers
      .map(
        (item) => `
        <tr>
          <td>${item.id}</td>
          <td>${item.name}</td>
          <td>${item.phone || ""}</td>
          <td>${item.zalo || ""}</td>
          <td>${item.registered_at || ""}</td>
          <td>
            <div class="actions">
              <button class="action" data-edit-customer="${item.id}">Sua</button>
              <button class="action danger" data-del-customer="${item.id}">Xoa</button>
            </div>
          </td>
        </tr>`
      )
      .join("");

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Ten</th><th>So dien thoai</th><th>Zalo</th><th>Ngay dang ky</th><th>Hanh dong</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    wrap.querySelectorAll("[data-edit-customer]").forEach((btn) => {
      btn.addEventListener("click", () => editCustomer(Number(btn.dataset.editCustomer)));
    });
    wrap.querySelectorAll("[data-del-customer]").forEach((btn) => {
      btn.addEventListener("click", () => deleteCustomer(Number(btn.dataset.delCustomer)));
    });
  }

  function renderOrders() {
    const wrap = document.getElementById("orders-table-wrap");
    if (!state.orders.length) {
      wrap.innerHTML = '<div class="empty">Chua co don hang.</div>';
      return;
    }
    const rows = state.orders
      .map(
        (item) => `
        <tr>
          <td>${item.id}</td>
          <td>${item.order_code || ""}</td>
          <td>${item.customer_name || `#${item.customer_id}`}</td>
          <td>${item.product_name || `#${item.product_id}`}</td>
          <td>${formatMoney(item.amount)}</td>
          <td>${item.status}</td>
          <td>${item.purchased_at || ""}</td>
          <td>
            <div class="actions">
              ${
                isOrderPending(item.status)
                  ? `<button type="button" class="action ok" data-confirm-payment="${item.id}">Xác nhận thanh toán</button>`
                  : ""
              }
              <button class="action" data-edit-order="${item.id}">Sua</button>
              <button class="action danger" data-del-order="${item.id}">Xoa</button>
            </div>
          </td>
        </tr>`
      )
      .join("");

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Ma don</th><th>Khach hang</th><th>San pham</th><th>So tien</th><th>Trang thai</th><th>Ngay mua</th><th>Hanh dong</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    wrap.querySelectorAll("[data-edit-order]").forEach((btn) => {
      btn.addEventListener("click", () => editOrder(Number(btn.dataset.editOrder)));
    });
    wrap.querySelectorAll("[data-del-order]").forEach((btn) => {
      btn.addEventListener("click", () => deleteOrder(Number(btn.dataset.delOrder)));
    });
    wrap.querySelectorAll("[data-confirm-payment]").forEach((btn) => {
      btn.addEventListener("click", () =>
        confirmPayment(Number(btn.dataset.confirmPayment)).catch((error) => alert(error.message))
      );
    });
  }

  async function addProduct() {
    const name = prompt("Ten san pham:");
    if (!name) return;
    const price = prompt("Gia:");
    if (price === null) return;
    const description = prompt("Mo ta:", "") || "";
    const stock = prompt("So luong ton:", "0");
    if (stock === null) return;
    await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name,
        price: Number(price),
        description,
        stock_quantity: Number(stock),
      }),
    });
    await loadAll();
  }

  async function editProduct(id) {
    const item = state.products.find((x) => x.id === id);
    if (!item) return;
    const name = prompt("Ten san pham:", item.name);
    if (!name) return;
    const price = prompt("Gia:", String(item.price));
    if (price === null) return;
    const description = prompt("Mo ta:", item.description || "") || "";
    const stock = prompt("So luong ton:", String(item.stock_quantity));
    if (stock === null) return;
    await api(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        price: Number(price),
        description,
        stock_quantity: Number(stock),
      }),
    });
    await loadAll();
  }

  async function deleteProduct(id) {
    if (!confirm("Xoa san pham nay?")) return;
    await api(`/api/products/${id}`, { method: "DELETE" });
    await loadAll();
  }

  async function addCustomer() {
    const name = prompt("Ten khach hang:");
    if (!name) return;
    const phone = prompt("So dien thoai:", "") || "";
    const zalo = prompt("Zalo:", "") || "";
    const registeredAt = prompt("Ngay dang ky (YYYY-MM-DD HH:MM:SS), bo trong de lay hien tai:", "") || null;
    await api("/api/customers", {
      method: "POST",
      body: JSON.stringify({
        name,
        phone,
        zalo,
        registered_at: registeredAt,
      }),
    });
    await loadAll();
  }

  async function editCustomer(id) {
    const item = state.customers.find((x) => x.id === id);
    if (!item) return;
    const name = prompt("Ten khach hang:", item.name);
    if (!name) return;
    const phone = prompt("So dien thoai:", item.phone || "") || "";
    const zalo = prompt("Zalo:", item.zalo || "") || "";
    const registeredAt = prompt(
      "Ngay dang ky (YYYY-MM-DD HH:MM:SS):",
      item.registered_at || ""
    );
    if (registeredAt === null) return;
    await api(`/api/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        phone,
        zalo,
        registered_at: registeredAt || null,
      }),
    });
    await loadAll();
  }

  async function deleteCustomer(id) {
    if (!confirm("Xoa khach hang nay?")) return;
    await api(`/api/customers/${id}`, { method: "DELETE" });
    await loadAll();
  }

  async function addOrder() {
    if (!state.customers.length) {
      alert("Can co it nhat 1 khach hang.");
      return;
    }
    if (!state.products.length) {
      alert("Can co it nhat 1 san pham.");
      return;
    }
    const customerList = state.customers.map((c) => `${c.id} - ${c.name}`).join("\n");
    const productList = state.products
      .map((p) => `${p.id} - ${p.name} (ton: ${p.stock_quantity})`)
      .join("\n");
    const customerId = prompt(`Nhap customer_id:\n${customerList}`);
    if (!customerId) return;
    const productId = prompt(`Nhap product_id:\n${productList}`);
    if (!productId) return;
    const amount = prompt("So tien don hang:");
    if (amount === null) return;
    const status = prompt("Trang thai (pending/paid/cancelled):", "pending") || "pending";
    const purchasedAt = prompt("Ngay mua (YYYY-MM-DD HH:MM:SS), bo trong de lay hien tai:", "") || null;

    await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customer_id: Number(customerId),
        product_id: Number(productId),
        amount: Number(amount),
        status,
        purchased_at: purchasedAt,
      }),
    });
    await loadAll();
  }

  async function editOrder(id) {
    const item = state.orders.find((x) => x.id === id);
    if (!item) return;
    const customerList = state.customers.map((c) => `${c.id} - ${c.name}`).join("\n");
    const productList = state.products.map((p) => `${p.id} - ${p.name}`).join("\n");

    const customerId = prompt(`Nhap customer_id:\n${customerList}`, String(item.customer_id));
    if (!customerId) return;
    const productId = prompt(`Nhap product_id:\n${productList}`, String(item.product_id));
    if (!productId) return;
    const amount = prompt("So tien don hang:", String(item.amount));
    if (amount === null) return;
    const status = prompt("Trang thai:", item.status || "pending");
    if (!status) return;
    const purchasedAt = prompt("Ngay mua (YYYY-MM-DD HH:MM:SS):", item.purchased_at || "");
    if (purchasedAt === null) return;

    await api(`/api/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        customer_id: Number(customerId),
        product_id: Number(productId),
        amount: Number(amount),
        status,
        purchased_at: purchasedAt || null,
      }),
    });
    await loadAll();
  }

  async function deleteOrder(id) {
    if (!confirm("Xoa don hang nay?")) return;
    await api(`/api/orders/${id}`, { method: "DELETE" });
    await loadAll();
  }

  async function confirmPayment(id) {
    if (!confirm("Xác nhận đã nhận tiền cho đơn này? Trạng thái sẽ chuyển sang success.")) return;
    await api(`/api/orders/${id}/confirm`, { method: "PUT", body: "{}" });
    await loadAll();
  }

  document.getElementById("add-product-btn").addEventListener("click", () => {
    addProduct().catch((error) => alert(error.message));
  });
  document.getElementById("add-customer-btn").addEventListener("click", () => {
    addCustomer().catch((error) => alert(error.message));
  });
  document.getElementById("add-order-btn").addEventListener("click", () => {
    addOrder().catch((error) => alert(error.message));
  });

  loadAll().catch((error) => {
    alert(`Khong tai duoc du lieu: ${error.message}`);
  });
})();
