const API_BASE = "/api";

const authViewEl = document.getElementById("auth-view");
const appShellEl = document.getElementById("app-shell");
const authStatusEl = document.getElementById("auth-status");
const roleBadgeEl = document.getElementById("role-badge");
const logoutBtnEl = document.getElementById("logout-btn");
const authMessageEl = document.getElementById("auth-message");
const themeToggleBtnEl = document.getElementById("theme-toggle-btn");
const themeToggleGlyphEl = document.getElementById("theme-toggle-glyph");
const openCartBtnEl = document.getElementById("open-cart-btn");
const cartCountEl = document.getElementById("cart-count");

const signupFormEl = document.getElementById("signup-form");
const loginFormEl = document.getElementById("login-form");
const loginPanelEl = document.getElementById("login-panel");
const signupPanelEl = document.getElementById("signup-panel");
const showSignupBtnEl = document.getElementById("show-signup-btn");
const showLoginBtnEl = document.getElementById("show-login-btn");

const tabButtons = Array.from(document.querySelectorAll(".tab[data-view]"));
const tabDashboardEl = document.getElementById("tab-dashboard");
const tabProductsEl = document.getElementById("tab-products");
const tabOrdersEl = document.getElementById("tab-orders");
const tabSuppliersEl = document.getElementById("tab-suppliers");
const tabEmployeesEl = document.getElementById("tab-employees");
const tabCustomersEl = document.getElementById("tab-customers");
const appViews = {
  dashboard: document.getElementById("dashboard-view"),
  products: document.getElementById("products-view"),
  orders: document.getElementById("orders-view"),
  suppliers: document.getElementById("suppliers-view"),
  employees: document.getElementById("employees-view"),
  customers: document.getElementById("customers-view")
};

const productFormPanelEl = document.getElementById("product-form-panel");
const productFormEl = document.getElementById("product-form");
const formMessageEl = document.getElementById("form-message");
const productListEl = document.getElementById("product-list");
const refreshProductsBtnEl = document.getElementById("refresh-products-btn");

const dashboardMessageEl = document.getElementById("dashboard-message");
const totalProductsEl = document.getElementById("total-products");
const totalStockEl = document.getElementById("total-stock");
const totalCustomersEl = document.getElementById("total-customers");
const totalEmployeesEl = document.getElementById("total-employees");

const ordersListEl = document.getElementById("orders-list");
const ordersMessageEl = document.getElementById("orders-message");
const refreshOrdersBtnEl = document.getElementById("refresh-orders-btn");

const receiptModalEl = document.getElementById("receipt-modal");
const receiptContentEl = document.getElementById("receipt-content");
const closeReceiptBtnEl = document.getElementById("close-receipt-btn");
const printReceiptBtnEl = document.getElementById("print-receipt-btn");

const paymentModalEl = document.getElementById("payment-modal");
const closePaymentBtnEl = document.getElementById("close-payment-btn");
const cancelPaymentBtnEl = document.getElementById("cancel-payment-btn");
const confirmPaymentBtnEl = document.getElementById("confirm-payment-btn");
const paymentMethodCashEl = document.getElementById("payment-method-cash");
const paymentMethodCardEl = document.getElementById("payment-method-card");
const creditCardFormEl = document.getElementById("credit-card-form");
const paymentCardNumberEl = document.getElementById("payment-card-number");
const paymentCardExpiryEl = document.getElementById("payment-card-expiry");
const paymentCardCvcEl = document.getElementById("payment-card-cvc");

const cartModalEl = document.getElementById("cart-modal");
const closeCartBtnEl = document.getElementById("close-cart-btn");
const cartItemsEl = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const clearCartBtnEl = document.getElementById("clear-cart-btn");
const checkoutCartBtnEl = document.getElementById("checkout-cart-btn");
const cartMessageEl = document.getElementById("cart-message");

const supplierFormEl = document.getElementById("supplier-form");
const suppliersMessageEl = document.getElementById("suppliers-message");
const suppliersTableBodyEl = document.getElementById("suppliers-table-body");
const refreshSuppliersBtnEl = document.getElementById("refresh-suppliers-btn");

const employeeFormEl = document.getElementById("employee-form");
const employeesMessageEl = document.getElementById("employees-message");
const employeesTableBodyEl = document.getElementById("employees-table-body");
const refreshEmployeesBtnEl = document.getElementById("refresh-employees-btn");

const customerFormEl = document.getElementById("customer-form");
const customersMessageEl = document.getElementById("customers-message");
const customersTableBodyEl = document.getElementById("customers-table-body");
const refreshCustomersBtnEl = document.getElementById("refresh-customers-btn");

let token = localStorage.getItem("token") || "";
let username = localStorage.getItem("username") || "";
let userRole = localStorage.getItem("role") || "";
let currentUserId = Number(localStorage.getItem("userId") || "") || null;
let activeView = "dashboard";
let activeReceiptOrder = null;
let activePaymentOrderId = null;
let ordersCache = [];
const expandedOrderIds = new Set();
let cart = [];

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  const nextModeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  themeToggleGlyphEl.textContent = theme === "dark" ? "☀️" : "🌙";
  themeToggleBtnEl.setAttribute("aria-label", nextModeLabel);
  themeToggleBtnEl.setAttribute("title", nextModeLabel);
}

function animateThemeTransition() {
  const root = document.documentElement;
  root.classList.add("theme-animating");
  window.setTimeout(() => {
    root.classList.remove("theme-animating");
  }, 280);
}

function initTheme() {
  const storedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = storedTheme || (prefersDark ? "dark" : "light");
  applyTheme(initialTheme);
}

function isAuthenticated() {
  return Boolean(token);
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function extractUserIdFromToken(jwtToken) {
  try {
    const [, payloadPart] = String(jwtToken || "").split(".");
    if (!payloadPart) {
      return null;
    }
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join("")
    );
    const payload = JSON.parse(json);
    const parsedId = Number(payload.userId);
    return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  } catch (_err) {
    return null;
  }
}

function showAuthPanel(panel) {
  const showSignup = panel === "signup";
  loginPanelEl.classList.toggle("hidden", showSignup);
  signupPanelEl.classList.toggle("hidden", !showSignup);
  loginFormEl.reset();
  signupFormEl.reset();
  setMessage(authMessageEl, "");
}

function syncModalBodyState() {
  const hasVisibleModal = !receiptModalEl.hidden || !paymentModalEl.hidden || !cartModalEl.hidden;
  document.body.classList.toggle("modal-open", hasVisibleModal);
}

function resetPaymentModalState() {
  paymentMethodCashEl.checked = true;
  paymentMethodCardEl.checked = false;
  creditCardFormEl.classList.add("hidden");
  paymentCardNumberEl.value = "";
  paymentCardExpiryEl.value = "";
  paymentCardCvcEl.value = "";
}

function openPaymentModal(orderId) {
  activePaymentOrderId = orderId;
  resetPaymentModalState();
  paymentModalEl.classList.remove("hidden");
  paymentModalEl.hidden = false;
  paymentModalEl.setAttribute("aria-hidden", "false");
  syncModalBodyState();
}

function closePaymentModal() {
  activePaymentOrderId = null;
  resetPaymentModalState();
  paymentModalEl.classList.add("hidden");
  paymentModalEl.hidden = true;
  paymentModalEl.setAttribute("aria-hidden", "true");
  syncModalBodyState();
}

function syncPaymentMethodUi() {
  creditCardFormEl.classList.toggle("hidden", !paymentMethodCardEl.checked);
}

async function confirmPayment() {
  if (!Number.isInteger(activePaymentOrderId)) {
    return;
  }

  if (paymentMethodCardEl.checked) {
    const cardNumber = paymentCardNumberEl.value.trim();
    const expiry = paymentCardExpiryEl.value.trim();
    const cvc = paymentCardCvcEl.value.trim();
    if (!cardNumber || !expiry || !cvc) {
      alert("Please fill in Card Number, MM/YY, and CVC.");
      return;
    }
  }

  try {
    await apiRequest(`/orders/${activePaymentOrderId}/pay`, {
      method: "PATCH"
    }, true);

    closePaymentModal();
    setMessage(ordersMessageEl, "Payment successful. Order marked as paid.");
    await loadOrders();
  } catch (error) {
    setMessage(ordersMessageEl, error.message, true);
    alert(error.message || "Payment failed.");
  }
}

function openCartModal() {
  cartModalEl.classList.remove("hidden");
  cartModalEl.hidden = false;
  cartModalEl.setAttribute("aria-hidden", "false");
  syncModalBodyState();
}

function closeCartModal() {
  cartModalEl.classList.add("hidden");
  cartModalEl.hidden = true;
  cartModalEl.setAttribute("aria-hidden", "true");
  syncModalBodyState();
}

function updateCartUi() {
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  cartCountEl.textContent = String(totalQty);
  cartTotalEl.textContent = formatCurrency(totalPrice);

  if (cart.length === 0) {
    cartItemsEl.innerHTML = "<p class=\"empty-state\">Your cart is empty.</p>";
    return;
  }

  cartItemsEl.innerHTML = cart.map((item) => `
    <article class="cart-item">
      <p class="cart-item-name">${escapeHtml(item.name)}</p>
      <p class="cart-item-meta">Qty: ${item.quantity} • ${formatCurrency(item.price)} each</p>
      <button type="button" class="ghost cart-item-remove" data-cart-remove="${item.product_id}">Remove</button>
    </article>
  `).join("");
}

function clearCart() {
  cart = [];
  updateCartUi();
}

function addToCart(product) {
  const existing = cart.find((entry) => entry.product_id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1
    });
  }

  updateCartUi();
}

async function resolveCheckoutRefs() {
  const [customers, employees] = await Promise.all([
    apiRequest("/customers", {}, true),
    apiRequest("/employees", {}, true)
  ]);

  if (!customers.length || !employees.length) {
    throw new Error("Checkout requires at least one customer and one employee in the system.");
  }

  return {
    customer_id: customers[0].id,
    employee_id: employees[0].id
  };
}

async function checkoutCart() {
  if (!cart.length) {
    setMessage(cartMessageEl, "Your cart is empty.", true);
    return;
  }

  try {
    const refs = await resolveCheckoutRefs();
    const payload = {
      customer_id: refs.customer_id,
      employee_id: refs.employee_id,
      items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity }))
    };

    await apiRequest("/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    }, true);

    clearCart();
    closeCartModal();
    setMessage(formMessageEl, "Order placed! Please go to your Orders to print your receipt and pay.");
    setMessage(cartMessageEl, "");
    await loadProducts();
  } catch (error) {
    setMessage(cartMessageEl, error.message, true);
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(amount) || 0);
}

function formatOrderDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function apiRequest(path, options = {}, requireAuth = false) {
  const requestOptions = { ...options };
  requestOptions.headers = {
    ...(options.headers || {}),
    ...(requireAuth ? authHeaders() : {})
  };

  const response = await fetch(`${API_BASE}${path}`, requestOptions);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || body.error || "Request failed.");
  }

  return body;
}

function updateAuthUi() {
  const authenticated = isAuthenticated();
  authStatusEl.textContent = authenticated ? `Logged in as ${username}` : "Not logged in";
  logoutBtnEl.hidden = !authenticated;
  openCartBtnEl.hidden = !(authenticated && userRole === "consumer");

  if (authenticated) {
    const roleText = userRole === "admin" ? "Admin" : "Consumer";
    roleBadgeEl.textContent = roleText;
    roleBadgeEl.classList.remove("hidden");
    roleBadgeEl.hidden = false;
    roleBadgeEl.classList.toggle("admin", userRole === "admin");
    roleBadgeEl.classList.toggle("consumer", userRole !== "admin");
  } else {
    roleBadgeEl.classList.add("hidden");
    roleBadgeEl.hidden = true;
    roleBadgeEl.classList.remove("admin", "consumer");
  }

  tabButtons.forEach((button) => {
    button.disabled = !authenticated;
  });
}

function applyRoleRestrictions() {
  const authenticated = isAuthenticated();
  const isConsumer = userRole === "consumer";
  document.body.setAttribute("data-role", userRole || "guest");

  const visibleViews = authenticated && isConsumer
    ? ["products", "orders"]
    : ["dashboard", "products", "orders", "suppliers", "employees", "customers"];

  tabOrdersEl.textContent = authenticated && isConsumer ? "My Orders" : "Orders";

  if (authenticated && isConsumer) {
    tabDashboardEl.hidden = true;
    tabSuppliersEl.hidden = true;
    tabEmployeesEl.hidden = true;
    tabCustomersEl.hidden = true;
    tabProductsEl.hidden = false;
    tabOrdersEl.hidden = false;
  }

  tabButtons.forEach((button) => {
    button.hidden = !visibleViews.includes(button.dataset.view);
  });

  productFormPanelEl.hidden = authenticated && isConsumer;

  if (!authenticated || !isConsumer) {
    closeCartModal();
    setMessage(cartMessageEl, "");
  }

  if (authenticated && !visibleViews.includes(activeView)) {
    activeView = isConsumer ? "products" : "dashboard";
  }
}

function renderView() {
  const authenticated = isAuthenticated();
  authViewEl.classList.toggle("active", !authenticated);
  appShellEl.classList.toggle("active", authenticated);

  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView && authenticated);
  });

  Object.entries(appViews).forEach(([viewName, element]) => {
    element.classList.toggle("active", authenticated && viewName === activeView);
  });
}

async function loadDashboard() {
  try {
    const [products, customers, employees] = await Promise.all([
      apiRequest("/products"),
      apiRequest("/customers", {}, true),
      apiRequest("/employees", {}, true)
    ]);

    const totalStock = products.reduce((sum, product) => sum + Number(product.stock_quantity || 0), 0);
    totalProductsEl.textContent = String(products.length);
    totalStockEl.textContent = String(totalStock);
    totalCustomersEl.textContent = String(customers.length);
    totalEmployeesEl.textContent = String(employees.length);
    setMessage(dashboardMessageEl, "Live metrics loaded.");
  } catch (error) {
    setMessage(dashboardMessageEl, error.message, true);
  }
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const stock = Number(product.stock_quantity || 0);
  const isAdmin = userRole === "admin";
  const isConsumer = userRole === "consumer";
  const isOut = stock === 0;
  const showIncrement = isAdmin;

  if (isAdmin) {
    card.classList.add("product-card-admin");
  }

  let stockBadgeText = `Stock: ${stock}`;
  let stockBadgeClass = "badge stock-exact";
  if (isConsumer) {
    if (stock > 5) {
      stockBadgeText = "In Stock";
      stockBadgeClass = "badge stock-in";
    } else if (stock > 0) {
      stockBadgeText = "Low in Stock";
      stockBadgeClass = "badge stock-low";
    } else {
      stockBadgeText = "Out of Stock";
      stockBadgeClass = "badge stock-out";
    }
  }

  const controls = `
    ${showIncrement ? `<button type="button" class="stock-btn plus" data-action="increment" data-id="${product.id}" title="Add stock">+</button>` : ""}
    <button type="button" class="stock-btn minus ${isConsumer ? "buy-btn" : ""}" data-action="${isConsumer ? "add-to-cart" : "decrement"}" data-id="${product.id}" ${isOut ? "disabled" : ""} title="Buy">
      ${isConsumer ? "Add to Cart" : "-"}
    </button>
  `;

  card.innerHTML = `
    ${isAdmin ? `<button type="button" class="product-delete-btn" data-action="delete-product" data-id="${product.id}" title="Delete product" aria-label="Delete product"><svg class="product-delete-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 10v7"/><path d="M14 10v7"/></svg></button>` : ""}
    <div class="product-head">
      <h3>${escapeHtml(product.name)}</h3>
      <span class="${stockBadgeClass}">${stockBadgeText}</span>
    </div>
    <p class="meta">Price: ${formatCurrency(product.price)}</p>
    <div class="stock-controls">${controls}</div>
  `;

  card.querySelectorAll(".stock-btn, .product-delete-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "delete-product") {
        const shouldDelete = window.confirm("Are you sure you want to delete this product?");
        if (!shouldDelete) {
          return;
        }

        try {
          await apiRequest(`/products/${product.id}`, { method: "DELETE" }, true);
          setMessage(formMessageEl, "Product deleted.");
          await loadProducts();
          if (userRole === "admin") {
            await loadDashboard();
          }
        } catch (error) {
          alert(error.message || "Failed to delete product.");
          setMessage(formMessageEl, error.message, true);
        }
        return;
      }

      if (action === "add-to-cart") {
        addToCart(product);
        setMessage(formMessageEl, `${product.name} added to cart.`);
        return;
      }
      await updateStock(product.id, action);
    });
  });

  return card;
}

async function loadProducts() {
  productListEl.classList.add("product-grid");
  if (userRole === "consumer") {
    productListEl.classList.add("consumer-grid-flow");
  } else {
    productListEl.classList.remove("consumer-grid-flow");
  }

  productListEl.innerHTML = "<p class=\"empty-state\">Loading products...</p>";
  try {
    const products = await apiRequest("/products");
    if (products.length === 0) {
      productListEl.innerHTML = "<p class=\"empty-state\">No products found.</p>";
      return;
    }

    productListEl.innerHTML = "";
    products.forEach((product) => {
      productListEl.appendChild(createProductCard(product));
    });
    setMessage(formMessageEl, "Products loaded.");
  } catch (error) {
    productListEl.innerHTML = "<p class=\"empty-state\">Failed to load products.</p>";
    setMessage(formMessageEl, error.message, true);
  }
}

async function updateStock(productId, action) {
  if (!isAuthenticated()) {
    setMessage(formMessageEl, "Please login first.", true);
    return;
  }

  if (action === "increment" && userRole !== "admin") {
    setMessage(formMessageEl, "Only admins can add stock.", true);
    return;
  }

  try {
    await apiRequest(`/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ action, quantity: 1 })
    }, true);

    setMessage(formMessageEl, action === "decrement" ? "Purchase completed." : "Stock increased.");
    await loadProducts();
  } catch (error) {
    setMessage(formMessageEl, error.message, true);
  }
}

function buildReceiptHtml(order) {
  const normalizedItems = (order.items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price_at_time_of_purchase || 0);
    return {
      name: item.product_name,
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = Number(order.total_amount || subtotal);
  const paymentStatus = String(order.status || "Pending");

  const lineItemsHtml = normalizedItems.map((item) => `
    <div class="receipt-line-item">
      <span class="item-name">${escapeHtml(item.name)}</span>
      <span class="item-meta">${item.quantity} x ${formatCurrency(item.unitPrice)}</span>
    </div>
  `).join("");

  return `
    <section class="receipt-paper">
      <header class="receipt-store-header">
        <h3>SUPERMARKET POS</h3>
        <p>Order #${order.id}</p>
      </header>

      <div class="receipt-meta-grid">
        <p><strong>Date & Time</strong><span>${escapeHtml(formatOrderDate(order.order_date))}</span></p>
        <p><strong>Username</strong><span>${escapeHtml(order.customer_name)}</span></p>
      </div>

      <div class="receipt-items-list">
        ${lineItemsHtml || '<p class="receipt-empty">No items found.</p>'}
      </div>

      <div class="receipt-totals">
        <p><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></p>
        <p class="total-row"><span>Total</span><span>${formatCurrency(total)}</span></p>
      </div>

      <footer class="receipt-payment-status ${paymentStatus === "Paid" ? "paid" : "pending"}">
        PAYMENT STATUS: ${escapeHtml(paymentStatus.toUpperCase())}
      </footer>
    </section>
  `;
}

function openReceiptModal(order) {
  activeReceiptOrder = order;
  receiptContentEl.innerHTML = buildReceiptHtml(order);
  receiptModalEl.classList.remove("hidden");
  receiptModalEl.hidden = false;
  receiptModalEl.setAttribute("aria-hidden", "false");
  syncModalBodyState();
}

function closeReceiptModal() {
  activeReceiptOrder = null;
  receiptModalEl.classList.add("hidden");
  receiptModalEl.hidden = true;
  receiptModalEl.setAttribute("aria-hidden", "true");
  syncModalBodyState();
}

function renderOrders(orders) {
  if (orders.length === 0) {
    ordersListEl.innerHTML = "<p class=\"empty-state\">No orders found.</p>";
    return;
  }

  ordersListEl.innerHTML = orders.map((order) => {
    const isExpanded = expandedOrderIds.has(order.id);
    const itemsRows = (order.items || []).map((item) => {
      const lineTotal = Number(item.quantity) * Number(item.price_at_time_of_purchase);
      return `
        <tr>
          <td>${escapeHtml(item.product_name)}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.price_at_time_of_purchase)}</td>
          <td>${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    }).join("");

    return `
      <article class="order-card" data-order-id="${order.id}">
        <button type="button" class="order-summary" data-action="toggle-order" data-order-id="${order.id}">
          <span>#${order.id} • ${escapeHtml(order.customer_name)}</span>
          <span>${escapeHtml(formatOrderDate(order.order_date))} • ${formatCurrency(order.total_amount)}</span>
        </button>
        <div class="order-details ${isExpanded ? "open" : ""}">
          <div class="order-meta">
            <p><strong>Customer:</strong> ${escapeHtml(order.customer_name)}</p>
            <p><strong>Employee:</strong> ${escapeHtml(order.employee_name)}</p>
            <p><strong>Status:</strong> <span class="order-status ${order.status === "Paid" ? "paid" : "pending"}">${escapeHtml(order.status || "Pending")}</span></p>
          </div>
          <div class="table-wrap">
            <table class="data-table compact">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows || "<tr><td colspan=\"4\">No line items</td></tr>"}
              </tbody>
            </table>
          </div>
          <div class="order-actions">
            ${order.status === "Pending"
              ? userRole === "admin"
                ? `<button type="button" class="admin-bypass-btn" data-action="admin-pay-order" data-order-id="${order.id}">Mark as Paid (Bypass)</button>`
                : `<button type="button" class="pay-now-btn" data-action="pay-order" data-order-id="${order.id}">Pay Now</button>`
              : `<span class="payment-complete-badge">Payment Complete</span>`}
            <button type="button" class="ghost" data-action="print-order" data-order-id="${order.id}">Print Receipt</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function loadOrders() {
  ordersListEl.innerHTML = "<p class=\"empty-state\">Loading orders...</p>";
  try {
    const orders = await apiRequest("/orders", {}, true);
    ordersCache = orders;
    renderOrders(orders);
    setMessage(ordersMessageEl, "Orders loaded.");
  } catch (error) {
    setMessage(ordersMessageEl, error.message, true);
    ordersListEl.innerHTML = "<p class=\"empty-state\">Failed to load orders.</p>";
  }
}

function renderSuppliers(rows) {
  if (rows.length === 0) {
    suppliersTableBodyEl.innerHTML = "<tr><td colspan=\"4\">No suppliers found.</td></tr>";
    return;
  }

  suppliersTableBodyEl.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.contact_info)}</td>
      <td><button type="button" class="table-action danger" data-entity="supplier" data-id="${row.id}">Delete</button></td>
    </tr>
  `).join("");
}

function renderEmployees(rows) {
  if (rows.length === 0) {
    employeesTableBodyEl.innerHTML = "<tr><td colspan=\"5\">No employees found.</td></tr>";
    return;
  }

  employeesTableBodyEl.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.role)}</td>
      <td>${row.user_id == null ? "-" : row.user_id}</td>
      <td><button type="button" class="table-action danger" data-entity="employee" data-id="${row.id}">Delete</button></td>
    </tr>
  `).join("");
}

function renderCustomers(rows) {
  if (rows.length === 0) {
    customersTableBodyEl.innerHTML = "<tr><td colspan=\"4\">No customers found.</td></tr>";
    return;
  }

  customersTableBodyEl.innerHTML = rows.map((row) => {
    const displayName = row.username || row.name || "Unknown";
    const displayRoleRaw = String(row.role || "consumer").toLowerCase();
    const displayRole = displayRoleRaw === "admin" ? "Admin" : "Consumer";
    const rowUserId = Number(row.id);
    const isSelf = rowUserId === currentUserId;
    const canPromote = displayRoleRaw === "consumer" && userRole === "admin" && !isSelf;
    const canRemove = userRole === "admin" && !isSelf;
    const actions = [];
    if (canPromote) {
      actions.push(`<button type="button" class="table-action promote" data-action="promote-user" data-user-id="${rowUserId}">Make an Admin</button>`);
    }
    if (canRemove) {
      actions.push(`<button type="button" class="table-action remove-user" data-action="remove-user" data-user-id="${rowUserId}">Remove</button>`);
    }

    return `
    <tr>
      <td>${row.id}</td>
      <td>${escapeHtml(displayName)}</td>
      <td>${escapeHtml(displayRole)}</td>
      <td>${actions.length ? actions.join(" ") : "-"}</td>
    </tr>
  `;
  }).join("");
}

async function promoteUserToAdmin(userId) {
  const numericId = Number(userId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return;
  }

  const confirmed = window.confirm("Are you sure you want to make this user an Admin?");
  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(`/users/${numericId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: "admin" })
    }, true);
    alert("User promoted to Admin.");
    await loadCustomers();
  } catch (error) {
    setMessage(customersMessageEl, error.message, true);
    alert(error.message || "Failed to promote user.");
  }
}

async function removeUser(userId) {
  const numericId = Number(userId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return;
  }

  const confirmed = window.confirm("Are you sure you want to remove this user?");
  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(`/users/${numericId}`, {
      method: "DELETE"
    }, true);
    alert("User removed successfully.");
    await loadCustomers();
  } catch (error) {
    setMessage(customersMessageEl, error.message, true);
    alert(error.message || "Failed to remove user.");
  }
}

async function loadSuppliers() {
  try {
    const rows = await apiRequest("/suppliers", {}, true);
    renderSuppliers(rows);
    setMessage(suppliersMessageEl, "Suppliers loaded.");
  } catch (error) {
    setMessage(suppliersMessageEl, error.message, true);
  }
}

async function loadEmployees() {
  try {
    const rows = await apiRequest("/employees", {}, true);
    renderEmployees(rows);
    setMessage(employeesMessageEl, "Employees loaded.");
  } catch (error) {
    setMessage(employeesMessageEl, error.message, true);
  }
}

async function loadCustomers() {
  try {
    const rows = await apiRequest("/customers", {}, true);
    renderCustomers(rows);
    setMessage(customersMessageEl, "Customers loaded.");
  } catch (error) {
    setMessage(customersMessageEl, error.message, true);
  }
}

async function loadCurrentViewData() {
  if (activeView === "dashboard") {
    await loadDashboard();
    return;
  }

  if (activeView === "products") {
    await loadProducts();
    return;
  }

  if (activeView === "orders") {
    await loadOrders();
    return;
  }

  if (activeView === "suppliers") {
    await loadSuppliers();
    return;
  }

  if (activeView === "employees") {
    await loadEmployees();
    return;
  }

  if (activeView === "customers") {
    await loadCustomers();
  }
}

async function showAppView(viewName) {
  if (!isAuthenticated()) {
    return;
  }

  activeView = viewName;
  renderView();
  await loadCurrentViewData();
}

async function handleAuthFormSubmit(formElement, endpoint) {
  const formData = new FormData(formElement);
  const payload = {
    username: String(formData.get("username") || "").trim(),
    password: String(formData.get("password") || "")
  };

  try {
    const body = await apiRequest(`/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    token = body.token;
    currentUserId = Number(body.userId) || extractUserIdFromToken(body.token);
    username = body.username;
    userRole = body.role || "consumer";
    localStorage.setItem("token", token);
    localStorage.setItem("userId", String(currentUserId || ""));
    localStorage.setItem("username", username);
    localStorage.setItem("role", userRole);

    formElement.reset();
    setMessage(authMessageEl, `Welcome, ${username}.`);
    updateAuthUi();
    applyRoleRestrictions();
    await showAppView(userRole === "consumer" ? "products" : "dashboard");
  } catch (error) {
    setMessage(authMessageEl, error.message, true);
  }
}

async function deleteEntity(entity, id) {
  const map = {
    supplier: "/suppliers",
    employee: "/employees",
    customer: "/customers"
  };

  const endpoint = map[entity];
  if (!endpoint) {
    return;
  }

  try {
    await apiRequest(`${endpoint}/${id}`, { method: "DELETE" }, true);
    await loadCurrentViewData();
    await loadDashboard();
  } catch (error) {
    const messageEl = entity === "supplier"
      ? suppliersMessageEl
      : entity === "employee"
        ? employeesMessageEl
        : customersMessageEl;
    setMessage(messageEl, error.message, true);
  }
}

signupFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleAuthFormSubmit(signupFormEl, "signup");
});

loginFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleAuthFormSubmit(loginFormEl, "login");
});

showSignupBtnEl.addEventListener("click", () => {
  showAuthPanel("signup");
});

showLoginBtnEl.addEventListener("click", () => {
  showAuthPanel("login");
});

logoutBtnEl.addEventListener("click", () => {
  token = "";
  username = "";
  userRole = "";
  currentUserId = null;
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  setMessage(authMessageEl, "Logged out.");
  setMessage(dashboardMessageEl, "");
  setMessage(formMessageEl, "");
  setMessage(ordersMessageEl, "");
  setMessage(suppliersMessageEl, "");
  setMessage(employeesMessageEl, "");
  setMessage(customersMessageEl, "");
  setMessage(cartMessageEl, "");
  ordersListEl.innerHTML = "";
  expandedOrderIds.clear();
  clearCart();
  closeCartModal();
  closeReceiptModal();
  closePaymentModal();
  activeView = "dashboard";
  updateAuthUi();
  applyRoleRestrictions();
  renderView();
});

tabButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    await showAppView(button.dataset.view);
  });
});

supplierFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(supplierFormEl);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    contact_info: String(formData.get("contact_info") || "").trim()
  };

  try {
    await apiRequest("/suppliers", {
      method: "POST",
      body: JSON.stringify(payload)
    }, true);

    supplierFormEl.reset();
    setMessage(suppliersMessageEl, "Supplier added.");
    await loadSuppliers();
    await loadDashboard();
  } catch (error) {
    setMessage(suppliersMessageEl, error.message, true);
  }
});

employeeFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(employeeFormEl);
  const userIdRaw = String(formData.get("user_id") || "").trim();
  const payload = {
    name: String(formData.get("name") || "").trim(),
    role: String(formData.get("role") || "").trim(),
    user_id: userIdRaw ? Number(userIdRaw) : null
  };

  try {
    await apiRequest("/employees", {
      method: "POST",
      body: JSON.stringify(payload)
    }, true);

    employeeFormEl.reset();
    setMessage(employeesMessageEl, "Employee added.");
    await loadEmployees();
    await loadDashboard();
  } catch (error) {
    setMessage(employeesMessageEl, error.message, true);
  }
});

customerFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(customerFormEl);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim()
  };

  try {
    await apiRequest("/customers", {
      method: "POST",
      body: JSON.stringify(payload)
    }, true);

    customerFormEl.reset();
    setMessage(customersMessageEl, "Customer added.");
    await loadCustomers();
    await loadDashboard();
  } catch (error) {
    setMessage(customersMessageEl, error.message, true);
  }
});

refreshSuppliersBtnEl.addEventListener("click", loadSuppliers);
refreshEmployeesBtnEl.addEventListener("click", loadEmployees);
refreshCustomersBtnEl.addEventListener("click", loadCustomers);
refreshOrdersBtnEl.addEventListener("click", loadOrders);
refreshProductsBtnEl.addEventListener("click", loadProducts);

productFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAuthenticated()) {
    setMessage(formMessageEl, "Please login first.", true);
    return;
  }

  if (userRole !== "admin") {
    setMessage(formMessageEl, "Only admins can add products.", true);
    return;
  }

  const formData = new FormData(productFormEl);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    price: Number(formData.get("price")),
    stock_quantity: Number(formData.get("stock_quantity")),
    supplier_name: String(formData.get("supplier_name") || "").trim()
  };

  try {
    await apiRequest("/products", {
      method: "POST",
      body: JSON.stringify(payload)
    }, true);

    productFormEl.reset();
    setMessage(formMessageEl, "Product added successfully.");
    await loadProducts();
    if (userRole === "admin") {
      await loadDashboard();
    }
  } catch (error) {
    setMessage(formMessageEl, error.message, true);
  }
});

ordersListEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionEl = target.closest("[data-action]");
  if (!(actionEl instanceof HTMLButtonElement)) {
    return;
  }

  const action = actionEl.dataset.action;
  const orderId = Number(actionEl.dataset.orderId);
  if (!Number.isInteger(orderId)) {
    return;
  }

  if (action === "toggle-order") {
    if (expandedOrderIds.has(orderId)) {
      expandedOrderIds.delete(orderId);
    } else {
      expandedOrderIds.add(orderId);
    }
    renderOrders(ordersCache);
    return;
  }

  if (action === "print-order") {
    const order = ordersCache.find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }
    openReceiptModal(order);
    return;
  }

  if (action === "pay-order") {
    openPaymentModal(orderId);
    return;
  }

  if (action === "admin-pay-order") {
    try {
      await apiRequest(`/orders/${orderId}/pay`, {
        method: "PATCH"
      }, true);
      alert("Order marked as paid by Admin");
      setMessage(ordersMessageEl, "Order marked as paid by Admin.");
      await loadOrders();
    } catch (error) {
      setMessage(ordersMessageEl, error.message, true);
      alert(error.message || "Failed to mark order as paid.");
    }
  }
});

openCartBtnEl.addEventListener("click", () => {
  if (!isAuthenticated() || userRole !== "consumer") {
    return;
  }
  openCartModal();
});

closeCartBtnEl.addEventListener("click", closeCartModal);

closePaymentBtnEl.addEventListener("click", closePaymentModal);
cancelPaymentBtnEl.addEventListener("click", closePaymentModal);
confirmPaymentBtnEl.addEventListener("click", confirmPayment);
paymentMethodCashEl.addEventListener("change", syncPaymentMethodUi);
paymentMethodCardEl.addEventListener("change", syncPaymentMethodUi);

paymentModalEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.closePayment === "true") {
    closePaymentModal();
  }
});

cartModalEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.closeCart === "true") {
    closeCartModal();
    return;
  }

  const removeTarget = target.closest("[data-cart-remove]");
  if (removeTarget instanceof HTMLButtonElement) {
    const productId = Number(removeTarget.dataset.cartRemove);
    cart = cart.filter((item) => item.product_id !== productId);
    updateCartUi();
  }
});

clearCartBtnEl.addEventListener("click", () => {
  clearCart();
  setMessage(cartMessageEl, "Cart cleared.");
});

checkoutCartBtnEl.addEventListener("click", checkoutCart);

closeReceiptBtnEl.addEventListener("click", closeReceiptModal);
receiptModalEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.closeModal === "true") {
    closeReceiptModal();
  }
});

printReceiptBtnEl.addEventListener("click", () => {
  if (!activeReceiptOrder) {
    return;
  }
  window.print();
});

themeToggleBtnEl.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  animateThemeTransition();
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

suppliersTableBodyEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  if (target.dataset.entity === "supplier") {
    await deleteEntity("supplier", target.dataset.id);
  }
});

employeesTableBodyEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  if (target.dataset.entity === "employee") {
    await deleteEntity("employee", target.dataset.id);
  }
});

customersTableBodyEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = target.dataset.action;
  if (action === "promote-user") {
    await promoteUserToAdmin(target.dataset.userId);
    return;
  }

  if (action === "remove-user") {
    await removeUser(target.dataset.userId);
  }
});

initTheme();
if (!currentUserId && token) {
  currentUserId = extractUserIdFromToken(token);
  if (currentUserId) {
    localStorage.setItem("userId", String(currentUserId));
  }
}
closeReceiptModal();
closePaymentModal();
closeCartModal();
showAuthPanel("login");
updateCartUi();
updateAuthUi();
applyRoleRestrictions();
renderView();
if (isAuthenticated()) {
  showAppView(userRole === "consumer" ? "products" : "dashboard");
}
