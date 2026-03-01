/* ============================================
   MOVE PLUS — Admin Panel JavaScript
   Dados dinâmicos via API (PostgreSQL)
   ============================================ */

"use strict";

/* ===== API BASE ===== */
const API = "/api";

/* ===== SIZE MAP POR TIPO DE CATEGORIA ===== */
const SIZE_MAP = {
  clothing:  ["XS", "S", "M", "L", "XL", "XXL"],
  shoes:     ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
  fragrance: ["30ml", "50ml", "100ml", "150ml", "200ml", "250ml", "300ml", "350ml", "400ml", "450ml", "500ml", "550ml", "600ml", "650ml", "700ml", "750ml", "800ml", "850ml", "900ml", "950ml", "1000ml"],
};

function populateSizeCheckboxes(preSelected = []) {
  const catId     = document.getElementById("pCategory").value;
  const group     = document.getElementById("sizesGroup");
  const container = document.getElementById("sizesCheckboxes");
  if (!group || !container) return;

  // Buscar size_type da categoria selecionada
  const cat = allCategories.find(c => String(c.id) === String(catId));
  const sizeType = cat ? (cat.size_type || "none") : "none";
  const sizes = SIZE_MAP[sizeType];

  if (!sizes || sizes.length === 0) {
    group.style.display = "none";
    container.innerHTML = "";
    return;
  }

  group.style.display = "";
  container.innerHTML = sizes.map(s => {
    const checked = preSelected.includes(s) ? "checked" : "";
    return `
      <label style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid var(--border-light);border-radius:8px;cursor:pointer;font-size:0.85rem;background:var(--bg-card);transition:all .2s;">
        <input type="checkbox" name="product_size" value="${s}" ${checked}
          style="accent-color:var(--gold);" />
        ${s}
      </label>`;
  }).join("");
}

/* ===== STATE ===== */
let currentSection = "dashboard";
let editingProductId = null;
let editingCategoryId = null;
let allProducts = [];
let allOrders = [];
let allCustomers = [];
let allCategories = [];
let allMessages = [];

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", () => {
  verifyAdminAccess();
  initNavigation();
  initSidebarToggle();
  initThemeToggle();
  loadAll();
});

async function verifyAdminAccess() {
  const isLoggedIn = document.cookie.includes("is_logged_in=1");
  if (!isLoggedIn) {
    safeRedirect("../pages/loginPage.html");
    return;
  }
  
  try {
    const user = await apiFetch("/customers/me");
    if (!user || user.role !== "admin") {
      Toast.alert("Acesso Negado: Precisas de privilégios de Administrador.");
      safeRedirect("../index.html");
    }
  } catch (e) {
    safeRedirect("../pages/loginPage.html");
  }
}

async function loadAll() {
  await Promise.all([
    loadDashboard(),
    loadOrders(),
    loadProducts(),
    loadCategories(),
    loadCustomers(),
    loadMessages(),
    loadSettings(),
  ]);
}

/* ===== API HELPERS ===== */
async function apiFetch(endpoint, options = {}) {
  try {
    const headers = {
      "Content-Type": "application/json"
    };

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    const res = await fetch(`${API}${endpoint}`, {
      ...options,
      headers,
      credentials: "same-origin"
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.error(`API ${endpoint}:`, err);
    throw err;
  }
}

/* ===== NAVIGATION ===== */
function initNavigation() {
  const links = document.querySelectorAll(".sidebar__link[data-section]");
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      navigateTo(section);
    });
  });

  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.goto));
  });
}

function navigateTo(section) {
  document
    .querySelectorAll(".sidebar__link")
    .forEach((l) => l.classList.remove("active"));
  const activeLink = document.querySelector(
    `.sidebar__link[data-section="${section}"]`,
  );
  if (activeLink) activeLink.classList.add("active");

  document
    .querySelectorAll(".admin-section")
    .forEach((s) => s.classList.remove("active"));
  const activeSection = document.getElementById(`section-${section}`);
  if (activeSection) activeSection.classList.add("active");

  const titles = {
    dashboard: "Dashboard",
    orders: "Encomendas",
    products: "Produtos",
    categories: "Categorias",
    customers: "Clientes",
    messages: "Mensagens WhatsApp",
    settings: "Definições",
  };
  document.getElementById("topbarTitle").textContent =
    titles[section] || section;

  currentSection = section;

  if (window.innerWidth <= 900) {
    document.getElementById("adminSidebar").classList.remove("mobile-open");
  }
}

/* ===== SIDEBAR TOGGLE ===== */
function initSidebarToggle() {
  const btn = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("adminSidebar");
  const main = document.getElementById("adminMain");

  btn.addEventListener("click", () => {
    if (window.innerWidth <= 900) {
      sidebar.classList.toggle("mobile-open");
    } else {
      sidebar.classList.toggle("collapsed");
      main.classList.toggle("expanded");
    }
  });
}

/* ===== THEME ===== */
function initThemeToggle() {
  const btn = document.getElementById("adminThemeToggle");
  const saved = localStorage.getItem("adminTheme");
  if (saved === "dark") document.body.classList.add("dark-mode");

  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("adminTheme", isDark ? "dark" : "light");
    btn.querySelector("i").className = isDark
      ? "fa-solid fa-sun"
      : "fa-solid fa-moon";
  });
}

/* ===== DASHBOARD ===== */
async function loadDashboard() {
  try {
    const stats = await apiFetch("/dashboard/stats");

    // KPI cards
    const kpiOrders = document.getElementById("kpiOrders");
    const kpiRevenue = document.getElementById("kpiRevenue");
    const kpiCustomers = document.getElementById("kpiCustomers");
    const kpiOutOfStock = document.getElementById("kpiOutOfStock");
    
    // Percentage cards
    const kpiOrdersChange = document.getElementById("kpiOrdersChange");
    const kpiRevenueChange = document.getElementById("kpiRevenueChange");
    const kpiCustomersChange = document.getElementById("kpiCustomersChange");

    const updateKpiChange = (el, pct) => {
      if (!el) return;
      el.className = "kpi-card__change " + (pct > 0 ? "positive" : pct < 0 ? "negative" : "");
      let icon = pct > 0 ? "fa-arrow-up" : pct < 0 ? "fa-arrow-down" : "fa-minus";
      let displayPct = pct > 0 ? `+${pct}%` : `${pct}%`;
      el.innerHTML = `<i class="fa-solid ${icon}"></i> ${displayPct} vs mês anterior`;
    };

    if (kpiOrders) kpiOrders.textContent = stats.total_orders || 0;
    if (kpiOrdersChange) updateKpiChange(kpiOrdersChange, stats.orders_pct || 0);

    if (kpiRevenue) {
      const rev = stats.total_revenue || 0;
      kpiRevenue.textContent = rev >= 1000000
        ? `${(rev / 1000000).toFixed(2)}M Kz`
        : formatCurrency(rev);
    }
    if (kpiRevenueChange) updateKpiChange(kpiRevenueChange, stats.revenue_pct || 0);

    if (kpiCustomers) kpiCustomers.textContent = stats.total_customers || 0;
    if (kpiCustomersChange) updateKpiChange(kpiCustomersChange, stats.customers_pct || 0);

    if (kpiOutOfStock) kpiOutOfStock.textContent = stats.out_of_stock || 0;

    // Recent orders
    renderRecentOrders(stats.recent_orders || []);

    // Top products
    renderTopProducts(stats.top_products || []);

    // Chart (uses orders for last 7 days — simple aggregation client-side)
    renderChart();
  } catch (err) {
    showToast("Erro ao carregar dashboard: " + err.message, "error");
  }
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById("recentOrdersBody");
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Sem encomendas recentes</td></tr>`;
    return;
  }
  tbody.innerHTML = orders
    .map(
      (o) => `
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>${o.customer_name || "—"}</td>
      <td><strong style="color:var(--gold)">${formatCurrency(o.total)}</strong></td>
      <td>${statusBadge(o.status)}</td>
      <td style="color:var(--text-muted)">${formatDate(o.created_at)}</td>
    </tr>
  `,
    )
    .join("");
}

function renderTopProducts(products) {
  const container = document.getElementById("topProductsList");
  if (!container) return;
  if (!products.length) {
    container.innerHTML = `<p style="color:var(--text-muted);padding:20px;text-align:center">Sem dados</p>`;
    return;
  }
  container.innerHTML = products
    .map(
      (p) => `
    <div class="top-product-item">
      ${
        p.image_url
          ? `<img src="${p.image_url.split(',')[0].trim()}" alt="${p.name}" class="top-product-img" loading="lazy">`
          : `<div class="top-product-img" style="display:flex;align-items:center;justify-content:center;background:var(--gold-dim);color:var(--gold);font-size:1.2rem"><i class="fa-solid fa-box-open"></i></div>`
      }
      <div class="top-product-info">
        <div class="top-product-name">${p.name}</div>
        <div class="top-product-cat">${p.category_name || "—"}</div>
      </div>
      <div class="top-product-sales">${p.stock} em stock</div>
    </div>
  `,
    )
    .join("");
}

function renderChart() {
  const container = document.getElementById("chartBars");
  if (!container) return;

  // Generate chart from orders data (group by day of week)
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const daySums = new Array(7).fill(0);

  allOrders.forEach((o) => {
    const d = new Date(o.created_at);
    if (!isNaN(d)) daySums[d.getDay()] += o.total || 0;
  });

  // Reorder to start on Monday
  const chartData = [];
  for (let i = 1; i <= 7; i++) {
    const idx = i % 7;
    chartData.push({ day: dayNames[idx], value: daySums[idx] });
  }

  const max = Math.max(...chartData.map((d) => d.value), 1);
  container.innerHTML = chartData
    .map((d) => {
      const pct = Math.round((d.value / max) * 100);
      const displayVal = d.value >= 1000
        ? `${(d.value / 1000).toFixed(0)}K Kz`
        : `${d.value} Kz`;
      return `
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="height:${pct}%" data-value="${displayVal}"></div>
        <span class="chart-bar-label">${d.day}</span>
      </div>
    `;
    })
    .join("");
}

/* ===== ORDERS ===== */
async function loadOrders(statusFilter = "") {
  try {
    const endpoint = statusFilter
      ? `/orders?status=${statusFilter}`
      : "/orders";
    allOrders = await apiFetch(endpoint);
    renderOrders(allOrders);
    
    // Update sidebar badge for orders
    const badge = document.querySelector('.sidebar__link[data-section="orders"] .sidebar__badge');
    if (badge) badge.textContent = allOrders.filter(o => o.status === 'pendente' || o.status === 'processando').length || allOrders.length;
    
    // Also update chart when orders change
    renderChart();
  } catch (err) {
    showToast("Erro ao carregar encomendas: " + err.message, "error");
  }
}

function renderOrders(orders) {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">Nenhuma encomenda encontrada</td></tr>`;
    return;
  }
  tbody.innerHTML = orders
    .map(
      (o) => `
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>${o.customer_name || "—"}</td>
      <td style="color:var(--text-muted);font-size:0.8rem">${o.customer_phone || "—"}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.8rem">${o.items_text || "—"}</td>
      <td><strong style="color:var(--gold)">${formatCurrency(o.total)}</strong></td>
      <td>${statusBadge(o.status)}</td>
      <td style="color:var(--text-muted)">${formatDate(o.created_at)}</td>
      <td>
        <div class="table-actions">
          <button class="table-btn table-btn--view" title="Ver detalhes" onclick="viewOrder('${o.id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="table-btn table-btn--edit" title="Editar estado" onclick="editOrderStatus('${o.id}')"><i class="fa-solid fa-pen"></i></button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

document
  .getElementById("orderStatusFilter")
  .addEventListener("change", function () {
    loadOrders(this.value);
  });

function viewOrder(id) {
  const order = allOrders.find((o) => o.id === id);
  if (!order) return;

  const phone = order.customer_phone || "";

  document.getElementById("orderModalTitle").textContent =
    `Encomenda ${order.id}`;
  document.getElementById("orderModalBody").innerHTML = `
    <div class="order-detail-grid">
      <div class="order-detail-box">
        <h4>Informações do Cliente</h4>
        <div class="order-detail-row"><span>Nome</span><strong>${order.customer_name || "—"}</strong></div>
        <div class="order-detail-row"><span>Telefone</span><strong>${phone}</strong></div>
      </div>
      <div class="order-detail-box">
        <h4>Informações da Encomenda</h4>
        <div class="order-detail-row"><span>Data</span><strong>${formatDate(order.created_at)}</strong></div>
        <div class="order-detail-row"><span>Total</span><strong style="color:var(--gold)">${formatCurrency(order.total)}</strong></div>
        <div class="order-detail-row"><span>Estado</span>${statusBadge(order.status)}</div>
      </div>
    </div>
    <div class="order-detail-box" style="margin-bottom:16px">
      <h4>Produtos</h4>
      <div class="order-detail-row"><span>${order.items_text || "—"}</span></div>
    </div>
    <div class="order-status-select">
      <label>Actualizar Estado:</label>
      <select class="admin-select" id="orderNewStatus">
        <option value="pendente" ${order.status === "pendente" ? "selected" : ""}>Pendente</option>
        <option value="processando" ${order.status === "processando" ? "selected" : ""}>A processar</option>
        <option value="enviado" ${order.status === "enviado" ? "selected" : ""}>Enviado</option>
        <option value="entregue" ${order.status === "entregue" ? "selected" : ""}>Entregue</option>
        <option value="cancelado" ${order.status === "cancelado" ? "selected" : ""}>Cancelado</option>
      </select>
      <button class="btn-admin btn-admin--gold" onclick="updateOrderStatus('${order.id}')">Guardar</button>
    </div>
    <div class="admin-modal__footer">
      ${
        phone
          ? `<a href="https://wa.me/${phone.replace(/\s/g, "").replace("+", "")}" target="_blank" class="btn-admin btn-admin--outline">
              <i class="fa-brands fa-whatsapp" style="color:#25d366"></i> Contactar via WhatsApp
            </a>`
          : ""
      }
      <button class="btn-admin btn-admin--outline" onclick="closeOrderModal()">Fechar</button>
    </div>
  `;
  openModal("orderModalOverlay");
}

function editOrderStatus(id) {
  viewOrder(id);
}

async function updateOrderStatus(id) {
  const newStatus = document.getElementById("orderNewStatus").value;
  try {
    await apiFetch(`/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus }),
    });
    showToast("Estado da encomenda actualizado!", "success");
    closeOrderModal();
    await loadOrders();
    await loadDashboard();
  } catch (err) {
    showToast("Erro ao actualizar estado: " + err.message, "error");
  }
}

function exportOrders() {
  if (!allOrders.length) {
    showToast("Sem encomendas para exportar.", "info");
    return;
  }
  const header = "ID,Cliente,Contacto,Produtos,Total,Estado,Data\n";
  const csv = allOrders
    .map(
      (o) =>
        `"${o.id}","${o.customer_name || ""}","${o.customer_phone || ""}","${o.items_text || ""}",${o.total},"${o.status}","${o.created_at}"`,
    )
    .join("\n");
  const blob = new Blob([header + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `encomendas_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exportação concluída!", "success");
}

/* ===== PRODUCTS ===== */
async function loadProducts() {
  try {
    allProducts = await apiFetch("/products");
    renderProducts(allProducts);
  } catch (err) {
    showToast("Erro ao carregar produtos: " + err.message, "error");
  }
}

function renderProducts(products) {
  const tbody = document.getElementById("productsTableBody");
  if (!tbody) return;
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">Nenhum produto encontrado</td></tr>`;
    return;
  }
  tbody.innerHTML = products
    .map(
      (p) => `
    <tr>
      <td>
        ${
          p.image_url
            ? `<img src="${p.image_url.split(',')[0].trim()}" alt="${p.name}" class="product-thumb" loading="lazy">`
            : `<div class="product-thumb-placeholder"><i class="fa-solid fa-box-open"></i></div>`
        }
      </td>
      <td><strong style="font-size:0.88rem">${p.name}</strong></td>
      <td><span style="font-size:0.78rem;color:var(--text-muted)">${p.category_name || "—"}</span></td>
      <td><strong style="color:var(--gold)">${formatCurrency(p.price)}</strong>${p.old_price ? `<br><span style="font-size:0.75rem;color:var(--text-muted);text-decoration:line-through">${formatCurrency(p.old_price)}</span>` : ""}</td>
      <td>
        <span style="color:${p.stock === 0 ? "var(--danger)" : p.stock < 10 ? "var(--warning)" : "var(--success)"}; font-weight:600">
          ${p.stock === 0 ? "Sem stock" : p.stock}
        </span>
      </td>
      <td>${statusBadgeProduct(p.status)}</td>
      <td>
        <div class="table-actions">
          <button class="table-btn table-btn--edit" title="Editar" onclick="openProductModal(${p.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="table-btn table-btn--delete" title="Eliminar" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function filterProducts() {
  const searchVal = document
    .getElementById("productSearch")
    .value.toLowerCase();
  const catVal = document.getElementById("productCatFilter").value;
  const filtered = allProducts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchVal) ||
      (p.category_name || "").toLowerCase().includes(searchVal);
    const matchesCat = catVal ? (p.category_name || "") === catVal : true;
    return matchesSearch && matchesCat;
  });
  renderProducts(filtered);
}

function openProductModal(id = null) {
  editingProductId = id;
  const modal = document.getElementById("productModal");
  const title = document.getElementById("productModalTitle");

  // Populate categories dropdown dynamically
  const catSelect = document.getElementById("pCategory");
  catSelect.innerHTML = `<option value="">Selecionar...</option>`;
  allCategories.forEach((c) => {
    catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });

  if (id) {
    const p = allProducts.find((p) => p.id === id);
    if (!p) return;
    title.textContent = "Editar Produto";
    document.getElementById("pName").value = p.name;
    document.getElementById("pCategory").value = p.category_id || "";
    document.getElementById("pPrice").value = p.price;
    document.getElementById("pOldPrice").value = p.old_price || "";
    document.getElementById("pStock").value = p.stock;
    document.getElementById("pStatus").value = p.status;
    document.getElementById("pImageUrl").value = p.image_url || "";
    document.getElementById("pTag").value = p.tag || "";
    document.getElementById("pDescription").value = p.description || "";
    document.getElementById("pGender").value = p.gender || "unissexo";

    // Tamanhos pré-selecionados
    const existingSizes = p.available_sizes ? p.available_sizes.split(",").map(s => s.trim()).filter(Boolean) : [];
    populateSizeCheckboxes(existingSizes);

    // Mostrar imagem actual na zona de pré-visualização
    const existingUrl = p.image_url ? p.image_url.split(',')[0].trim() : "";
    _setImagePreview(existingUrl);
  } else {
    title.textContent = "Novo Produto";
    modal.querySelector("form").reset();
    document.getElementById("pImageUrl").value = "";
    document.getElementById("pGender").value = "unissexo";
    _setImagePreview("");
    populateSizeCheckboxes([]);
  }

  // Drag-and-drop na zona de upload
  _initImageDrop(document.getElementById("imgUploadZone"));

  openModal("productModalOverlay");
}

function closeProductModal() {
  closeModal("productModalOverlay");
  editingProductId = null;
}

async function saveProduct(e) {
  e.preventDefault();

  const fileInput = document.getElementById("pImageFile");
  const hasNewFile  = fileInput && fileInput.files && fileInput.files.length > 0;

  // Construir FormData (suporta ficheiro + campos de texto)
  const fd = new FormData();
  fd.append("name",        document.getElementById("pName").value);
  fd.append("category_id", document.getElementById("pCategory").value || "");
  fd.append("price",       document.getElementById("pPrice").value);
  fd.append("old_price",   document.getElementById("pOldPrice").value || "");
  fd.append("stock",       document.getElementById("pStock").value || "0");
  fd.append("status",      document.getElementById("pStatus").value);
  fd.append("tag",         document.getElementById("pTag").value);
  fd.append("description", document.getElementById("pDescription").value);
  fd.append("gender",      document.getElementById("pGender").value || "unissexo");

  // Recolher tamanhos selecionados
  const checkedSizes = [...document.querySelectorAll('input[name="product_size"]:checked')].map(cb => cb.value);
  fd.append("available_sizes", checkedSizes.join(","));

  if (hasNewFile) {
    // Anexar cada ficheiro individualmente — o Multer lê como array
    Array.from(fileInput.files).forEach((f) => fd.append("imagem", f));
  } else {
    // Sem ficheiro novo → preservar URL existente (modo edição)
    fd.append("existing_image_url", document.getElementById("pImageUrl").value || "");
  }

  // Endpoint e método consoante criar ou editar
  const url    = editingProductId
    ? `/api/products/${editingProductId}`
    : "/api/products";
  const method = editingProductId ? "PUT" : "POST";

  // Botão de submit — feedback visual
  const submitBtn = e.submitter || document.querySelector("#productModal [type='submit']");
  const originalLabel = submitBtn ? submitBtn.innerHTML : "";
  if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> A guardar...`;

  try {
    // Não necessita enviar Authorization local, o cookie lida com isso.
    const headers = {};

    const res = await fetch(url, { method, headers, credentials: "same-origin", body: fd });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);

    showToast(
      editingProductId ? "Produto actualizado com sucesso!" : "Produto criado com sucesso!",
      "success"
    );
    closeProductModal();
    await loadProducts();
    await loadDashboard();
  } catch (err) {
    showToast("Erro ao guardar produto: " + err.message, "error");
  } finally {
    if (submitBtn) submitBtn.innerHTML = originalLabel;
  }
}

/* ── Pré-visualização de múltiplas imagens ───────────── */
function previewProductImage(input) {
  const files = input.files ? Array.from(input.files) : [];
  if (!files.length) return;

  const count = files.length;
  document.getElementById("imgFileName").textContent =
    count === 1 ? files[0].name : `${count} ficheiros seleccionados`;

  const imageFiles = files.filter((f) => f.type.startsWith("image/"));

  if (!imageFiles.length) {
    // Só vídeos — mostrar apenas contagem
    _setThumbnails([]);
    return;
  }

  // Carregar todas as imagens antes de renderizar
  const promises = imageFiles.slice(0, 10).map(
    (f) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(f);
      })
  );

  Promise.all(promises).then((srcs) => _setThumbnails(srcs));
}

function _setThumbnails(srcs) {
  const grid = document.getElementById("imgThumbnails");
  const placeholder = document.getElementById("imgPlaceholder");
  if (!grid || !placeholder) return;

  if (!srcs || !srcs.length) {
    grid.style.display = "none";
    grid.innerHTML = "";
    placeholder.style.display = "flex";
    return;
  }

  grid.innerHTML = srcs
    .map(
      (src) =>
        `<img src="${src}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid var(--gold);" />`
    )
    .join("");
  grid.style.display = "flex";
  placeholder.style.display = "none";
}

function _setImagePreview(src) {
  // Compat: quando se abre o modal em edição mostra a imagem existente
  const grid = document.getElementById("imgThumbnails");
  const placeholder = document.getElementById("imgPlaceholder");
  if (!grid || !placeholder) return;
  if (src) {
    grid.innerHTML = `<img src="${src}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid var(--gold);" />`;
    grid.style.display = "flex";
    placeholder.style.display = "none";
  } else {
    grid.innerHTML = "";
    grid.style.display = "none";
    placeholder.style.display = "flex";
  }
}

function _initImageDrop(zone) {
  if (!zone || zone._dropReady) return;
  zone._dropReady = true;
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave",  ()  => zone.classList.remove("drag-over"));
  zone.addEventListener("drop",      (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    // Suportar múltiplos ficheiros arrastados
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (!droppedFiles.length) return;
    const fileInput = document.getElementById("pImageFile");
    const dt = new DataTransfer();
    droppedFiles.forEach((f) => dt.items.add(f));
    fileInput.files = dt.files;
    previewProductImage(fileInput);
  });
}

async function deleteProduct(id) {
  const ok = await Toast.confirm("Tens a certeza que queres eliminar este produto? Esta acção não pode ser revertida.");
  if (!ok) return;
  try {
    await apiFetch(`/products/${id}`, { method: "DELETE" });
    showToast("Produto eliminado.", "info");
    await loadProducts();
    await loadDashboard();
  } catch (err) {
    showToast("Erro ao eliminar produto: " + err.message, "error");
  }
}

/* ===== CATEGORIES ===== */
async function loadCategories() {
  try {
    allCategories = await apiFetch("/categories");
    renderCategories(allCategories);
    populateCategoryFilters();
  } catch (err) {
    showToast("Erro ao carregar categorias: " + err.message, "error");
  }
}

function populateCategoryFilters() {
  // Populate the product filter dropdown
  const productCatFilter = document.getElementById("productCatFilter");
  if (productCatFilter) {
    const currentVal = productCatFilter.value;
    productCatFilter.innerHTML = `<option value="">Todas as categorias</option>`;
    allCategories.forEach((c) => {
      productCatFilter.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    productCatFilter.value = currentVal;
  }
}

function renderCategories(cats) {
  const grid = document.getElementById("categoriesGrid");
  if (!grid) return;
  if (!cats.length) {
    grid.innerHTML = `<p style="color:var(--text-muted);padding:40px;text-align:center">Nenhuma categoria encontrada</p>`;
    return;
  }
  grid.innerHTML = cats
    .map(
      (c) => `
    <div class="category-admin-card">
      ${
        c.image_url
          ? `<img src="${c.image_url}" alt="${c.name}" class="category-admin-img" loading="lazy">`
          : `<div class="category-admin-img-placeholder"><i class="${c.icon || "fa-solid fa-folder"}"></i></div>`
      }
      <div class="category-admin-info">
        <div class="category-admin-name">${c.name}</div>
        <div class="category-admin-count">${c.product_count || 0} produtos</div>
        <div style="font-size:0.75rem; color:var(--gold); margin-bottom: 8px;">
            ${getSizeTypeLabel(c.size_type)}
        </div>
        <div class="category-admin-actions">
          <button class="btn-admin btn-admin--outline" style="font-size:0.78rem;padding:7px 14px" onclick="openCategoryModal(${c.id})">
            <i class="fa-solid fa-pen"></i> Editar
          </button>
          <button class="btn-admin btn-admin--danger" style="font-size:0.78rem;padding:7px 14px" onclick="deleteCategory(${c.id})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

function openCategoryModal(id = null) {
  editingCategoryId = id;
  const title = document.getElementById("categoryModalTitle");

  if (id) {
    const c = allCategories.find((c) => c.id === id);
    if (!c) return;
    title.textContent = "Editar Categoria";
    document.getElementById("cName").value = c.name;
    document.getElementById("cSlug").value = c.slug;
    document.getElementById("cImage").value = c.image_url || "";
    document.getElementById("cIcon").value = c.icon || "";
    document.getElementById("cSizeType").value = c.size_type || "none";
  } else {
    title.textContent = "Nova Categoria";
    document.getElementById("categoryModal").querySelector("form").reset();
    document.getElementById("cSizeType").value = "none";
  }

  openModal("categoryModalOverlay");
}

function closeCategoryModal() {
  closeModal("categoryModalOverlay");
  editingCategoryId = null;
}

async function saveCategory(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById("cName").value,
    slug:
      document.getElementById("cSlug").value ||
      document.getElementById("cName").value.toLowerCase().replace(/\s+/g, "-"),
    image_url: document.getElementById("cImage").value,
    icon: document.getElementById("cIcon").value,
    size_type: document.getElementById("cSizeType").value,
  };

  try {
    if (editingCategoryId) {
      await apiFetch(`/categories/${editingCategoryId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      showToast("Categoria actualizada!", "success");
    } else {
      await apiFetch("/categories", {
        method: "POST",
        body: JSON.stringify(data),
      });
      showToast("Categoria criada!", "success");
    }

    closeCategoryModal();
    await loadCategories();
    await loadDashboard();
  } catch (err) {
    showToast("Erro ao guardar categoria: " + err.message, "error");
  }
}

async function deleteCategory(id) {
  const ok = await Toast.confirm("Tens a certeza que queres eliminar esta categoria? Os produtos associados ficarão sem categoria.");
  if (!ok) return;
  try {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    showToast("Categoria eliminada.", "info");
    await loadCategories();
    await loadDashboard();
  } catch (err) {
    showToast("Erro ao eliminar categoria: " + err.message, "error");
  }
}

/* ===== CUSTOMERS ===== */
async function loadCustomers() {
  try {
    allCustomers = await apiFetch("/customers");
    renderCustomers(allCustomers);
  } catch (err) {
    showToast("Erro ao carregar clientes: " + err.message, "error");
  }
}

function renderCustomers(customers) {
  const tbody = document.getElementById("customersTableBody");
  if (!tbody) return;
  if (!customers.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">Nenhum cliente encontrado</td></tr>`;
    return;
  }
  tbody.innerHTML = customers
    .map(
      (c) => `
    <tr>
      <td>
        <div class="customer-avatar">${c.name.charAt(0)}</div>
      </td>
      <td><strong>${c.name}</strong></td>
      <td style="color:var(--text-muted)">${c.phone || "—"}</td>
      <td style="text-align:center"><strong>${c.order_count || 0}</strong></td>
      <td><strong style="color:var(--gold)">${formatCurrency(c.total_spent || 0)}</strong></td>
      <td style="color:var(--text-muted)">${c.member_since || "—"}</td>
      <td>
        <div class="table-actions">
          ${
            c.phone
              ? `<a href="https://wa.me/${c.phone.replace(/\s/g, "").replace("+", "")}" target="_blank" class="table-btn table-btn--view" title="Contactar via WhatsApp" style="color:#25d366;background:#dcfce7">
                  <i class="fa-brands fa-whatsapp"></i>
                </a>`
              : ""
          }
          <button class="table-btn table-btn--delete" title="Remover" onclick="deleteCustomer(${c.id})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function filterCustomers() {
  const searchVal = document
    .getElementById("customerSearch")
    .value.toLowerCase();
  const filtered = allCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchVal) ||
      (c.phone || "").includes(searchVal),
  );
  renderCustomers(filtered);
}

async function deleteCustomer(id) {
  const ok = await Toast.confirm("Tens a certeza que queres remover este cliente?");
  if (!ok) return;
  try {
    await apiFetch(`/customers/${id}`, { method: "DELETE" });
    showToast("Cliente removido.", "info");
    await loadCustomers();
    await loadDashboard();
  } catch (err) {
    showToast("Erro ao remover cliente: " + err.message, "error");
  }
}

/* ===== MESSAGES ===== */
async function loadMessages() {
  try {
    allMessages = await apiFetch("/messages");
    renderMessages(allMessages);
    // Update sidebar badge - fixed to target messages, if such badge exists
    const badge = document.querySelector('.sidebar__link[data-section="messages"] .sidebar__badge');
    if (badge) badge.textContent = allMessages.length;
  } catch (err) {
    showToast("Erro ao carregar mensagens: " + err.message, "error");
  }
}

function renderMessages(messages) {
  const container = document.getElementById("messagesList");
  if (!container) return;
  if (!messages.length) {
    container.innerHTML = `<p style="color:var(--text-muted);padding:40px;text-align:center">Nenhuma mensagem encontrada</p>`;
    return;
  }
  container.innerHTML = messages
    .map(
      (m) => `
    <div class="message-card">
      <div class="message-avatar"><i class="fa-brands fa-whatsapp"></i></div>
      <div class="message-info">
        <div class="message-name">${m.customer_name} <span style="color:var(--text-muted);font-weight:400;font-size:0.8rem">${m.phone || ""}</span></div>
        <div class="message-text">${m.text}</div>
        <div class="message-time"><i class="fa-regular fa-clock"></i> ${formatTimeAgo(m.created_at)}</div>
      </div>
      <div class="message-actions">
        ${
          m.phone
            ? `<a href="https://wa.me/${m.phone.replace(/\s/g, "").replace("+", "")}" target="_blank" class="btn-admin btn-admin--gold" style="font-size:0.8rem;padding:8px 16px">
                <i class="fa-brands fa-whatsapp"></i> Responder
              </a>`
            : ""
        }
        <button class="btn-admin btn-admin--danger" style="font-size:0.8rem;padding:8px 16px" onclick="deleteMessage(${m.id})">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `,
    )
    .join("");
}

async function deleteMessage(id) {
  const ok = await Toast.confirm("Eliminar esta mensagem?");
  if (!ok) return;
  try {
    await apiFetch(`/messages/${id}`, { method: "DELETE" });
    showToast("Mensagem eliminada.", "info");
    await loadMessages();
  } catch (err) {
    showToast("Erro ao eliminar mensagem: " + err.message, "error");
  }
}

/* ===== SETTINGS ===== */
async function loadSettings() {
  try {
    const settings = await apiFetch("/settings");
    if (!settings) return;

    document.getElementById("sName").value = settings.shop_name || "";
    document.getElementById("sSlogan").value = settings.shop_slogan || "";
    document.getElementById("sEmail").value = settings.shop_email || "";
    document.getElementById("sWhatsapp").value = settings.shop_whatsapp || "";
    document.getElementById("sLocation").value = settings.shop_location || "";
    document.getElementById("sInstagram").value = settings.social_instagram || "";
    document.getElementById("sFacebook").value = settings.social_facebook || "";
    document.getElementById("sTiktok").value = settings.social_tiktok || "";
    document.getElementById("sColorPicker").value = settings.primary_color || "#b8860b";
    document.getElementById("sColorText").value = settings.primary_color || "#b8860b";
    document.getElementById("sDeliveryFee").value = settings.delivery_fee || 0;
    document.getElementById("sFreeDelivery").value = settings.free_delivery_threshold || 0;
    document.getElementById("sDeliveryTime").value = settings.delivery_time || "";
    // ── Imagens do site (hero / login) ──
    const showPreview = (url, imgId, placeholderId) => {
      const img = document.getElementById(imgId);
      const ph  = document.getElementById(placeholderId);
      if (img && url) {
        img.src = url;
        img.style.display = "block";
        if (ph) ph.style.display = "none";
      }
    };
    showPreview(settings.hero_image_url,  "heroImagePreview",  "heroImagePlaceholder");
    showPreview(settings.login_image_url, "loginImagePreview", "loginImagePlaceholder");

  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

async function saveSettings(e) {
  e.preventDefault();
  
  const payload = {
    shop_name: document.getElementById("sName").value,
    shop_slogan: document.getElementById("sSlogan").value,
    shop_email: document.getElementById("sEmail").value,
    shop_whatsapp: document.getElementById("sWhatsapp").value,
    shop_location: document.getElementById("sLocation").value,
    social_instagram: document.getElementById("sInstagram").value,
    social_facebook: document.getElementById("sFacebook").value,
    social_tiktok: document.getElementById("sTiktok").value,
    primary_color: document.getElementById("sColorPicker").value,
    delivery_fee: parseInt(document.getElementById("sDeliveryFee").value) || 0,
    free_delivery_threshold: parseInt(document.getElementById("sFreeDelivery").value) || 0,
    delivery_time: document.getElementById("sDeliveryTime").value
  };

  try {
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> A Guardar...`;
    btn.disabled = true;

    await apiFetch("/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    
    showToast("Definições guardadas com sucesso!", "success");
    
    btn.innerHTML = originalText;
    btn.disabled = false;
  } catch(err) {
    showToast("Erro ao guardar definições: " + err.message, "error");
  }
}

/* ── Preview para imagens das settings (hero / login) ── */
function previewSettingsImage(input, previewId, placeholderId) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById(previewId);
    const ph  = document.getElementById(placeholderId);
    if (img) { img.src = e.target.result; img.style.display = "block"; }
    if (ph)  ph.style.display = "none";
  };
  reader.readAsDataURL(file);
}

/* ── Guardar imagens das settings ── */
async function saveSettingsImages(e) {
  e.preventDefault();

  const heroFile  = document.getElementById("heroImageFile");
  const loginFile = document.getElementById("loginImageFile");

  const hasHero  = heroFile  && heroFile.files  && heroFile.files.length  > 0;
  const hasLogin = loginFile && loginFile.files && loginFile.files.length > 0;

  if (!hasHero && !hasLogin) {
    showToast("Seleciona pelo menos uma imagem para guardar.", "warning");
    return;
  }

  const fd = new FormData();
  if (hasHero)  fd.append("hero_image",  heroFile.files[0]);
  if (hasLogin) fd.append("login_image", loginFile.files[0]);

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn ? btn.innerHTML : "";
  if (btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> A Enviar...`; btn.disabled = true; }

  try {
    const headers = {};

    const res = await fetch("/api/settings/images", { method: "POST", headers, credentials: "same-origin", body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);

    showToast("Imagens guardadas com sucesso!", "success");

    // Limpar inputs
    if (heroFile)  heroFile.value  = "";
    if (loginFile) loginFile.value = "";
  } catch (err) {
    showToast("Erro ao guardar imagens: " + err.message, "error");
  } finally {
    if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
  }
}

/* ===== MODALS HELPERS ===== */
function openModal(overlayId) {
  document.getElementById(overlayId).classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(overlayId) {
  document.getElementById(overlayId).classList.remove("open");
  document.body.style.overflow = "";
}

// adminConfirm has been removed -- use Toast.confirm() globally

function closeOrderModal() {
  closeModal("orderModalOverlay");
}

// Close modals on overlay click
document.querySelectorAll(".admin-modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }
  });
});

/* ===== GLOBALS ===== */
// showToast is injected globally via js/toast.js

/* ===== HELPERS ===== */
function formatCurrency(val) {
  return (val || 0).toLocaleString("pt-AO") + " Kz";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD}d`;
}

function statusBadge(status) {
  const map = {
    pendente: "pending",
    processando: "processing",
    enviado: "shipped",
    entregue: "delivered",
    cancelado: "cancelled",
  };
  const labelPT = {
    pendente: "Pendente",
    processando: "A processar",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelado: "Cancelado",
  };
  return `<span class="status-badge status-badge--${map[status] || "pending"}">${labelPT[status] || status}</span>`;
}

function statusBadgeProduct(status) {
  const map = { ativo: "active", inativo: "inactive", rascunho: "draft" };
  const labelPT = {
    ativo: "Activo",
    inativo: "Inactivo",
    rascunho: "Rascunho",
  };
  return `<span class="status-badge status-badge--${map[status] || "draft"}">${labelPT[status] || status}</span>`;
}

function getSizeTypeLabel(type) {
  const map = {
    none: "Sem tamanho",
    clothing: "Vestuário",
    shoes: "Calçado",
    fragrance: "Perfumaria",
  };
  return map[type] || "Sem tamanho";
}
