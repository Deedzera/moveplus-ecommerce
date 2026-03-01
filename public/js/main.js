/* ============================================
   PALACIO REAL — Main JavaScript
   ============================================ */

document.addEventListener("DOMContentLoaded", async () => {
  initThemeToggle();
  await initNavbarCategories();
  injectAdminIcon();
  initMobileMenu();
  initScrollAnimations();
  initQuantityControls();
  initVariationButtons();
  initNavbarScroll();
  initSettings();
  initSearchAutocomplete();
});

/* ---------- Admin Icon Injector ---------- */
async function injectAdminIcon() {
  const isLoggedIn = document.cookie.includes("is_logged_in=1");
  if (!isLoggedIn) return;
  try {
    const user = await API.getLoggedUser();
    if (user && user.role === 'admin') {
      const actionsDiv = document.querySelector('.navbar__actions');
      if (!actionsDiv) return;
      
      const isRoot = !window.location.pathname.includes("/pages/");
      const link = isRoot ? "pages/adminPage.html" : "adminPage.html";
      
      const adminBtn = document.createElement("a");
      adminBtn.href = link;
      adminBtn.className = "navbar__icon";
      adminBtn.title = "Admin";
      adminBtn.style.color = "var(--gold)";
      adminBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';

      const hamburger = document.querySelector(".navbar__hamburger");
      if (hamburger) {
        actionsDiv.insertBefore(adminBtn, hamburger);
      } else {
        actionsDiv.appendChild(adminBtn);
      }
    }
  } catch(e) {
    console.error("Erro ao injetar icone de admin:", e);
  }
}

/* ---------- Navbar Categories Hydrator ---------- */
async function initNavbarCategories() {
  if (typeof API === "undefined" || !API.getCategories) return;
  const navMenu = document.getElementById("navMenu");
  if (!navMenu) return;

  try {
    const categories = await API.getCategories();
    if (categories && categories.length > 0) {
      const isRoot = !window.location.pathname.includes("/pages/");
      const pagesPrefix = isRoot ? "pages/" : "";
      
      navMenu.innerHTML = categories.map(cat => {
        return `<li><a href="${pagesPrefix}categPage.html?cat=${cat.slug}" class="navbar__link">${cat.name}</a></li>`;
      }).join("");
    } else {
      navMenu.innerHTML = "";
    }
  } catch (err) {
    console.error("Failed to load navbar categories", err);
    navMenu.innerHTML = "";
  }
}


/* ---------- Global Settings Hydrator ---------- */
async function initSettings() {
  if (typeof API === "undefined" || !API.getSettings) return;
  try {
    const settings = await API.getSettings();
    if (!settings) return;

    // Apply primary color to CSS variables globally
    if (settings.primary_color) {
      document.documentElement.style.setProperty("--primary", settings.primary_color);
      document.documentElement.style.setProperty("--primary-hover", settings.primary_color); // Simplified for hover
    }

    // Safely apply text to nodes
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el && text) el.textContent = text;
    };

    setText("gBrandName", settings.shop_name);
    setText("gBrandSlogan", settings.shop_slogan);
    setText("gTextWhatsapp", settings.shop_whatsapp);
    setText("gTextEmail", settings.shop_email);
    setText("gTextLocation", settings.shop_location);

    // Safely apply hrefs to nodes
    const setHref = (id, link) => {
      const el = document.getElementById(id);
      if (el && link) el.href = link;
    };

    setHref("gImgInstagram", settings.social_instagram);
    setHref("gImgFacebook", settings.social_facebook);
    setHref("gImgTiktok", settings.social_tiktok);

    // Format Whatsapp Number to link 
    let waNumber = settings.shop_whatsapp ? settings.shop_whatsapp.replace(/\D/g, '') : "244999999999";
    const waLink = "https://wa.me/" + waNumber;

    setHref("gImgWhatsapp", waLink);
    setHref("gLinkWhatsapp", waLink);
    setHref("gFloatingWhatsapp", waLink);
    setHref("gNavWhatsapp", waLink);
    
    // Store WhatsApp Globally for Product checkout function
    window.GLOBAL_WHATSAPP = waNumber;

    // Store settings globally for delivery fee logic in Cart
    window.GLOBAL_SETTINGS = settings;

    // Apply dynamic hero image if configured
    if (settings.hero_image_url) {
      const heroImg = document.getElementById("heroImage");
      if (heroImg) heroImg.src = settings.hero_image_url;
    }

  } catch (err) {
    console.warn("Settings skip:", err);
  }
}

/* ---------- Dark Mode Toggle ---------- */
function initThemeToggle() {
  const saved = localStorage.getItem("palacio_theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Apply saved theme or system preference
  if (saved === "dark" || (!saved && prefersDark)) {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("palacio_theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("palacio_theme", "dark");
    }
  });
}

/* ---------- Mobile Menu (Drawer) ---------- */
function initMobileMenu() {
  const hamburger = document.querySelector(".navbar__hamburger");
  if (!hamburger) return;

  // Build drawer only once
  if (document.querySelector(".mobile-drawer")) return;

  // Collect nav links
  const navLinks = document.querySelectorAll(".navbar__nav .navbar__link");
  const actionIcons = document.querySelectorAll(".navbar__actions .navbar__icon");

  // Determine path prefix (index vs pages/)
  const isRoot = !window.location.pathname.includes("/pages/");
  const prefix = isRoot ? "pages/" : "";
  const homeHref = isRoot ? "index.html" : "../index.html";

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "mobile-overlay";
  document.body.appendChild(overlay);

  // Create drawer
  const drawer = document.createElement("div");
  drawer.className = "mobile-drawer";

  // Header
  let html = `
    <div class="mobile-drawer__header">
      <div class="mobile-drawer__logo">Move <span>Plus</span></div>
      <button class="mobile-drawer__close" aria-label="Fechar menu">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <nav class="mobile-drawer__nav">
      <div class="mobile-drawer__section">Navegação</div>
      <a href="${homeHref}" class="mobile-drawer__link">
        <i class="fa-solid fa-house"></i> Início
      </a>`;

  // Nav links
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const text = link.textContent.trim();
    const icons = {
      Perfumes: "fa-spray-can-sparkles",
      Cremes: "fa-pump-soap",
      Roupa: "fa-shirt",
      "Acessórios": "fa-gem",
    };
    const icon = icons[text] || "fa-tag";
    html += `<a href="${href}" class="mobile-drawer__link"><i class="fa-solid ${icon}"></i> ${text}</a>`;
  });

  html += `<div class="mobile-drawer__divider"></div>
    <div class="mobile-drawer__section">A Minha Conta</div>`;

  // Action icons — cart, profile, whatsapp, admin
  const iconMap = {
    Carrinho: { icon: "fa-bag-shopping", label: "Carrinho" },
    Perfil: { icon: "fa-user", label: "A Minha Conta" },
    WhatsApp: { icon: "fa-brands fa-whatsapp", label: "WhatsApp", style: "color:var(--whatsapp)" },
    Admin: { icon: "fa-shield-halved", label: "Painel Admin", style: "color:var(--gold)" },
  };

  actionIcons.forEach((el) => {
    const title = el.getAttribute("title") || "";
    const href = el.getAttribute("href") || "#";
    const target = el.getAttribute("target") || "";
    const mapped = iconMap[title];
    if (mapped) {
      const cls = title === "WhatsApp" ? mapped.icon : "fa-solid " + mapped.icon;
      const st = mapped.style ? ` style="${mapped.style}"` : "";
      const tg = target ? ` target="${target}"` : "";
      html += `<a href="${href}" class="mobile-drawer__link"${tg}><i class="${cls}"${st}></i> ${mapped.label}</a>`;
    }
  });

  // Footer with theme toggle
  html += `</nav>
    <div class="mobile-drawer__footer">
      <button class="mobile-drawer__theme-btn" id="mobileThemeBtn">
        <i class="fa-solid fa-moon icon-moon"></i>
        <i class="fa-solid fa-sun icon-sun"></i>
        <span class="label-dark">Modo Escuro</span>
        <span class="label-light">Modo Claro</span>
      </button>
    </div>`;

  drawer.innerHTML = html;
  document.body.appendChild(drawer);

  // Toggle functions
  function openDrawer() {
    drawer.classList.add("active");
    overlay.classList.add("active");
    hamburger.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer.classList.remove("active");
    overlay.classList.remove("active");
    hamburger.classList.remove("active");
    document.body.style.overflow = "";
  }

  hamburger.addEventListener("click", () => {
    drawer.classList.contains("active") ? closeDrawer() : openDrawer();
  });

  overlay.addEventListener("click", closeDrawer);

  drawer.querySelector(".mobile-drawer__close").addEventListener("click", closeDrawer);

  // Close on link click
  drawer.querySelectorAll(".mobile-drawer__link").forEach((link) => {
    link.addEventListener("click", closeDrawer);
  });

  // Mobile theme toggle
  const mobileThemeBtn = drawer.querySelector("#mobileThemeBtn");
  if (mobileThemeBtn) {
    mobileThemeBtn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (isDark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("move_theme", "light");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("move_theme", "dark");
      }
    });
  }
}

/* ---------- Navbar scroll effect ---------- */
function initNavbarScroll() {
  const navbar = document.querySelector(".navbar");
  if (!navbar) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 60) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  });
}

/* ---------- Scroll Animations ---------- */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
  );

  document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
}

/* ---------- Quantity Controls ---------- */
function initQuantityControls() {
  document.querySelectorAll(".qty-control").forEach((control) => {
    const input = control.querySelector("input");
    const minusBtn = control.querySelector('[data-qty="minus"]');
    const plusBtn = control.querySelector('[data-qty="plus"]');

    if (!input || !minusBtn || !plusBtn) return;

    minusBtn.addEventListener("click", () => {
      const val = parseInt(input.value) || 1;
      if (val > 1) input.value = val - 1;
    });

    plusBtn.addEventListener("click", () => {
      const val = parseInt(input.value) || 1;
      input.value = val + 1;
    });
  });
}

/* ---------- Variation Buttons ---------- */
function initVariationButtons() {
  document.querySelectorAll(".variation-group__options").forEach((group) => {
    group.querySelectorAll(".variation-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        group
          .querySelectorAll(".variation-btn")
          .forEach((b) => b.classList.remove("variation-btn--active"));
        btn.classList.add("variation-btn--active");
      });
    });
  });
}

/* ---------- WhatsApp Checkout ---------- */
function whatsappCheckout(productName, price, variation, quantity) {
  const phone = window.GLOBAL_WHATSAPP || "244999999999";
  const message = encodeURIComponent(
    `Olá! Gostaria de encomendar:\n\n` +
      `🛍️ Produto: ${productName}\n` +
      `💰 Preço: ${price}\n` +
      `📦 Variação: ${variation || "Padrão"}\n` +
      `🔢 Quantidade: ${quantity || 1}\n\n` +
      `Podem confirmar a disponibilidade?`,
  );

  window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
}

/* ---------- Build WhatsApp Link from Product Page ---------- */
function finalizeWhatsApp() {
  const name =
    document.querySelector(".product-detail__name")?.textContent || "Produto";
  const price =
    document.querySelector(".product-detail__price")?.textContent || "";
  const activeVariation =
    document.querySelector(".variation-btn--active")?.textContent || "";
  const qty = document.querySelector(".qty-control input")?.value || 1;

  whatsappCheckout(name, price, activeVariation, qty);
}

/* ---------- Cart (localStorage) ---------- */
const Cart = {
  KEY: "move_cart",

  getItems() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch {
      return [];
    }
  },

  addItem(product) {
    const items = this.getItems();
    const existing = items.find(
      (i) => i.id === product.id && i.variation === product.variation,
    );
    if (existing) {
      existing.qty += product.qty || 1;
    } else {
      items.push({ ...product, qty: product.qty || 1 });
    }
    localStorage.setItem(this.KEY, JSON.stringify(items));
    this.updateBadge();
  },

  getCount() {
    return this.getItems().reduce((sum, i) => sum + i.qty, 0);
  },

  updateItemQty(index, change) {
    const items = this.getItems();
    if (index >= 0 && index < items.length) {
      const newQty = items[index].qty + change;
      if (newQty > 0) {
        items[index].qty = newQty;
      } else {
        items.splice(index, 1);
      }
      localStorage.setItem(this.KEY, JSON.stringify(items));
      this.updateBadge();
    }
  },

  removeItem(index) {
    const items = this.getItems();
    if (index >= 0 && index < items.length) {
      items.splice(index, 1);
      localStorage.setItem(this.KEY, JSON.stringify(items));
      this.updateBadge();
    }
  },

  updateBadge() {
    const badges = document.querySelectorAll(".cart-badge");
    const count = this.getCount();
    badges.forEach((badge) => {
      badge.textContent = count;
      badge.style.display = count > 0 ? "flex" : "none";
    });
  },

  clear() {
    localStorage.removeItem(this.KEY);
    this.updateBadge();
  },
};

// Update badge on load
Cart.updateBadge();

/* ---------- Search Autocomplete ---------- */
function initSearchAutocomplete() {
  const searchContainers = document.querySelectorAll(".navbar__search");
  if (!searchContainers.length) return;

  searchContainers.forEach((container) => {
    const input = container.querySelector('input[type="text"]');
    if (!input) return;

    // Create dropdown container
    const resultsBox = document.createElement("div");
    resultsBox.className = "search-autocomplete-results";
    resultsBox.style.display = "none";
    container.appendChild(resultsBox);

    let debounceTimer;

    input.addEventListener("input", (e) => {
      const query = e.target.value.trim();

      clearTimeout(debounceTimer);

      if (query.length < 2) {
        resultsBox.style.display = "none";
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          // Add loading state
          resultsBox.innerHTML = '<div class="search-autocomplete-empty"><i class="fa-solid fa-spinner fa-spin"></i> A procurar...</div>';
          resultsBox.style.display = "flex";

          const products = await API.getProducts({ search: query, status: "ativo" });
          resultsBox.innerHTML = "";

          if (products && products.length > 0) {
            const isRoot = !window.location.pathname.includes("/pages/");
            const pagesPrefix = isRoot ? "pages/" : "";

            // Show up to 5 results
            const topResults = products.slice(0, 5);
            
            topResults.forEach(p => {
              const item = document.createElement("div");
              item.className = "search-autocomplete-item";
              
              const imgUrl = p.images && p.images[0] ? p.images[0].image_url : (isRoot ? 'assets/placeholder.jpg' : '../assets/placeholder.jpg');
              const priceFmt = (p.price || 0).toLocaleString("pt-PT") + " Kz";

              item.innerHTML = `
                <img src="${imgUrl}" alt="${p.name}">
                <div class="search-autocomplete-info">
                  <span class="search-autocomplete-title">${p.name}</span>
                  <span class="search-autocomplete-price">${priceFmt}</span>
                </div>
              `;

              item.addEventListener("click", () => {
                window.location.href = `${pagesPrefix}productPage.html?slug=${p.slug}`;
              });

              resultsBox.appendChild(item);
            });
            
            // "Ver todos os resultados" link
            if (products.length > 5) {
               const viewAll = document.createElement("div");
               viewAll.className = "search-autocomplete-item";
               viewAll.style.justifyContent = "center";
               viewAll.style.color = "var(--gold)";
               viewAll.style.fontWeight = "600";
               viewAll.innerHTML = `Ver todos (${products.length})`;
               viewAll.addEventListener("click", () => {
                 window.location.href = `${pagesPrefix}categPage.html?search=${encodeURIComponent(query)}`;
               });
               resultsBox.appendChild(viewAll);
            }

          } else {
            resultsBox.innerHTML = '<div class="search-autocomplete-empty">Nenhum produto encontrado.</div>';
          }
        } catch (err) {
          console.error("Erro no autocomplete:", err);
          resultsBox.style.display = "none";
        }
      }, 350); // 350ms debounce
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) {
        resultsBox.style.display = "none";
      }
    });

    // Reopen when focusing if there's text
    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2 && resultsBox.innerHTML !== "") {
        resultsBox.style.display = "flex";
      }
    });
    
    // Press enter to search
    input.addEventListener("keypress", (e) => {
       if (e.key === "Enter") {
         const query = e.target.value.trim();
         if (query) {
            const isRoot = !window.location.pathname.includes("/pages/");
            const pagesPrefix = isRoot ? "pages/" : "";
            window.location.href = `${pagesPrefix}categPage.html?search=${encodeURIComponent(query)}`;
         }
       }
    });
  });
}

