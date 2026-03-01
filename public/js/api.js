/* ============================================
   MOVE PLUS — JS API Integrations
   ============================================ */

const API_BASE_URL = "http://localhost:3000/api";

const API = {
  getToken() {
    // Agora guiamos-nos pelo cookie de estado "is_logged_in" em vez do token JWT em si,
    // que agora está num cookie HttpOnly. Retornamos true/false se logged in.
    return document.cookie.includes("is_logged_in=1");
  },

  getAuthHeaders(additionalHeaders = {}) {
    // Já não precisamos de adicionar o Authorization: Bearer, o cookie viaja sozinho
    return { ...additionalHeaders };
  },

  /**
   * Wrapper para fetch autenticado que deteta sessão expirada (login noutro dispositivo).
   * Se code === "SESSION_EXPIRED", faz logout automático e redireciona.
   */
  async _authFetch(url, options = {}) {
    const opts = { ...options, credentials: "same-origin" };
    const res = await fetch(url, opts);
    if (res.status === 401) {
      try {
        const clone = res.clone();
        const body = await clone.json();
        if (body.code === "SESSION_EXPIRED") {
          await fetch(`${API_BASE_URL}/customers/logout`, { method: "POST", credentials: "same-origin" });
          if (typeof showToast === "function") {
            showToast("Sessão terminada: fizeste login noutro dispositivo.", "error");
          }
          setTimeout(() => {
            const isInPages = window.location.pathname.includes("/pages/");
            safeRedirect(isInPages ? "loginPage.html" : "pages/loginPage.html");
          }, 1500);
          return null;
        }
      } catch (_) { /* ignore parse errors */ }
    }
    return res;
  },

  /**
   * Obtém os dados de sessão fidedignos diretamente da DB pelo JWT
   * @returns {Promise<Object|null>} Os dados do user, null se não logado ou sem token
   */
  async getLoggedUser() {
    try {
      const isLoggedIn = this.getToken();
      if (!isLoggedIn) return null;

      const res = await this._authFetch(`${API_BASE_URL}/customers/me`, {
        headers: this.getAuthHeaders({ "Content-Type": "application/json" })
      });
      if (!res || !res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn("Sessão inválida", err);
      return null;
    }
  },

  /**
   * Obtém todas as categorias
   * @returns {Promise<Array>} Lista de categorias
   */
  async getCategories() {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      if (!response.ok) throw new Error("Erro ao buscar categorias");
      return await response.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  /**
   * Obtém todos os produtos, com filtros opcionais
   * @param {Object} filters { category, search, status }
   * @returns {Promise<Array>} Lista de produtos
   */
  async getProducts(filters = {}) {
    try {
      const url = new URL(`${API_BASE_URL}/products`);
      if (filters.category) url.searchParams.append("category", filters.category);
      if (filters.search) url.searchParams.append("search", filters.search);
      if (filters.status) url.searchParams.append("status", filters.status);

      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao buscar produtos");
      return await response.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  /**
   * Obtém um único produto pelo seu ID
   * @param {string|number} id ID do produto
   * @returns {Promise<Object|null>} Produto detalhado ou null
   */
  async getProductById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`);
      if (!response.ok) throw new Error("Erro ao buscar produto");
      return await response.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Obtém um único produto pelo seu slug (URL amigável)
   * @param {string} slug Slug do produto (ex: "camisa-preta")
   * @returns {Promise<Object|null>} Produto detalhado ou null
   */
  async getProductBySlug(slug) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/slug/${slug}`);
      if (!response.ok) throw new Error("Erro ao buscar produto");
      return await response.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Tenta fazer login com email + password (retorna requires_otp: true)
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/customers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Erro no login");
    }
    // O backend agora trata dos cookies, não precisamos de guardar no localStorage
    return data;
  },

  /**
   * Regista um novo cliente
   * @param {Object} data - {name, email, phone, password}
   */
  async register(data) {
    const response = await fetch(`${API_BASE_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error || "Erro ao registar");
    }
    return resData;
  },

  /**
   * Verifica o código OTP
   * @param {Object} data - {email, otp}
   */
  async verifyOTP(data) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro ao verificar OTP");
      }
      const result = await response.json();
      // O token agora vai em cookie HttpOnly
      return result;
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  /**
   * Reenvia um código OTP
   * @param {Object} data - {email}
   */
  async resendOTP(data) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro ao reenviar OTP");
      }
      return await response.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  /**
   * Pede a recuperação de senha
   */
  async forgotPassword(email) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao pedir recuperação");
      }
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  /**
   * Repõe a senha usando o OTP
   */
  async resetPassword(data) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data) // {email, otp, newPassword}
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Erro ao repor senha");
      }
      return resData;
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  /**
   * Obtém detalhes de um cliente
   */
  async getCustomer(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) throw new Error("Erro ao buscar cliente");
      return await response.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Elimina a conta de um cliente
   */
  async deleteCustomer(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: "DELETE",
        headers: this.getAuthHeaders()
      });
      if (!response.ok) throw new Error("Erro ao eliminar conta");
      return await response.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  /**
   * Obtém as encomendas de um cliente
   */
  async getCustomerOrders(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders?customer_id=${id}`, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) throw new Error("Erro ao buscar encomendas");
      return await response.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  /**
   * Obtém as sessões ativas (dispositivos de confiança) de um cliente
   */
  async getTrustedDevices(customerId) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/trusted-devices?customerId=${customerId}`, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) throw new Error("Erro ao buscar sessões");
      return await response.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Remove uma sessão ativa (dispositivo de confiança)
   */
  async removeTrustedDevice(deviceId, customerId) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/trusted-devices/${deviceId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ customerId })
      });
      if (!response.ok) throw new Error("Erro ao remover sessão");
      return await response.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  /**
   * Obtém os endereços de um cliente
   */
  async getCustomerAddresses(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${id}/addresses`, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) throw new Error("Erro ao buscar endereços");
      return await response.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  /**
   * Adiciona um endereço a um cliente
   */
  async addCustomerAddress(id, addressData) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${id}/addresses`, {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(addressData)
      });
      if (!response.ok) throw new Error("Erro ao adicionar endereço");
      return await response.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  /**
   * Remove um endereço de um cliente
   */
  async deleteCustomerAddress(customerId, addressId) {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${customerId}/addresses/${addressId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders()
      });
      if (!response.ok) throw new Error("Erro ao remover endereço");
      return await response.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  /**
   * Formata preços em Akwa (Kz)
   */
  formatPrice(price) {
    return Number(price).toLocaleString("pt-PT") + " Kz";
  },

  /**
   * Gera o HTML de um cartão de produto
   * @param {Object} product
   * @param {Array|Set} [favoriteIds] - IDs dos produtos favoritados
   * @param {Object} [opts] - { linkPrefix: '' }
   */
  renderProductCard(product, favoriteIds = [], opts = {}) {
    const isNew = product.tag === "new";
    const isPromo = product.tag === "promo";
    const isBestseller = product.tag === "bestseller";
    const isOutOfStock = product.stock === 0 || product.stock === null;
    
    let tagHtml = "";
    if (isOutOfStock) tagHtml = '<span class="product-tag product-tag--promo" style="background:var(--danger,#e74c3c);">Esgotado</span>';
    else if (isNew) tagHtml = '<span class="product-tag product-tag--new">Novo</span>';
    else if (isPromo) tagHtml = '<span class="product-tag product-tag--promo">Promoção</span>';
    else if (isBestseller) tagHtml = '<span class="product-tag product-tag--bestseller">Mais Vendido</span>';

    const oldPriceHtml = product.old_price 
      ? `<span class="product-card__price-old">${this.formatPrice(product.old_price)}</span>` 
      : "";

    // Image fallback
    const imageUrl = product.image_url 
      ? product.image_url.split(",")[0].trim() 
      : "https://images.unsplash.com/photo-1541643600914-78b084683601?w=500&q=80";

    const outOfStockOverlay = isOutOfStock
      ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;border-radius:inherit;z-index:2;"><span style="color:#fff;font-weight:700;font-size:1rem;text-transform:uppercase;letter-spacing:1px;">Esgotado</span></div>'
      : "";

    // Favorited state
    const favSet = favoriteIds instanceof Set ? favoriteIds : new Set(favoriteIds);
    const isFav = favSet.has(product.id);
    const heartClass = isFav ? "fa-solid" : "fa-regular";
    const activeClass = isFav ? " active" : "";

    const linkPrefix = opts.linkPrefix != null ? opts.linkPrefix : "";
    const productHref = product.slug
      ? `${linkPrefix}/produto/${product.slug}`
      : `${linkPrefix}pages/productPage.html?id=${product.id}`;

    return `
      <a href="${productHref}" class="product-card" ${isOutOfStock ? 'style="opacity:0.7;"' : ''}>
        <div class="product-card__img-wrap" style="position:relative;">
          ${outOfStockOverlay}
          <img
            src="${imageUrl}"
            alt="${product.name}"
            class="product-card__img"
            loading="lazy"
          />
          <div class="product-card__tags">
            ${tagHtml}
          </div>
          <button class="product-card__wishlist${activeClass}" data-product-id="${product.id}" onclick="event.preventDefault(); event.stopPropagation(); window._toggleWishlist(this);" title="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
            <i class="${heartClass} fa-heart"></i>
          </button>
        </div>
        <div class="product-card__info">
          <span class="product-card__category">${product.category_name || 'Diversos'}</span>
          <h3 class="product-card__name">${product.name}</h3>
          <div class="product-card__price-row">
            <span class="product-card__price">${this.formatPrice(product.price)}</span>
            ${oldPriceHtml}
          </div>
        </div>
      </a>
    `;
  },

  /**
   * Gera o HTML para uma categoria na página inicial
   */
  renderCategoryCard(category) {
    const count = category.product_count || 0;
    const imageUrl = category.image_url || "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&q=80";
    
    return `
      <a href="pages/categPage.html?cat=${category.slug}" class="category-card">
        <img
          src="${imageUrl}"
          alt="${category.name}"
          class="category-card__img"
          loading="lazy"
        />
        <div class="category-card__overlay">
          <h3 class="category-card__name">${category.name}</h3>
          <span class="category-card__count">${count} produtos</span>
        </div>
      </a>
    `;
  },

  // --- CONFIG / SETTINGS ---
  async getSettings() {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`);
      if (!response.ok) throw new Error("Erro ao obter definições");
      return await response.json();
    } catch(err) {
      console.error(err);
      return null;
    }
  },

  async saveSettings(data) {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: "PUT",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Erro ao guardar definições");
      return await response.json();
    } catch(err) {
      console.error(err);
      throw err;
    }
  },

  // --- FAVORITOS ---

  /** Lista completa de favoritos do user logado (com dados do produto) */
  async getFavorites() {
    try {
      const res = await this._authFetch(`${API_BASE_URL}/favorites`, {
        headers: this.getAuthHeaders()
      });
      if (!res || !res.ok) return [];
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  /** Retorna array de product IDs favoritados */
  async getFavoriteIds() {
    try {
      const token = this.getToken();
      if (!token) return [];
      const res = await this._authFetch(`${API_BASE_URL}/favorites/ids`, {
        headers: this.getAuthHeaders()
      });
      if (!res || !res.ok) return [];
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  /** Toggle favorito (adiciona ou remove). Retorna { favorited: true/false } */
  async toggleFavorite(productId) {
    const res = await this._authFetch(`${API_BASE_URL}/favorites/${productId}`, {
      method: "POST",
      headers: this.getAuthHeaders({ "Content-Type": "application/json" })
    });
    if (!res || !res.ok) throw new Error("Erro ao atualizar favorito");
    return await res.json();
  },

  /** Remove favorito explicitamente */
  async removeFavorite(productId) {
    const res = await this._authFetch(`${API_BASE_URL}/favorites/${productId}`, {
      method: "DELETE",
      headers: this.getAuthHeaders()
    });
    if (!res || !res.ok) throw new Error("Erro ao remover favorito");
    return await res.json();
  }
};

/* ── Global Wishlist Toggle Handler ── */
window._toggleWishlist = async function (btn) {
  const isLoggedIn = document.cookie.includes("is_logged_in=1");
  if (!isLoggedIn) {
    if (typeof showToast === "function") {
      showToast("Faz login para guardar favoritos.", "error");
    }
    return;
  }

  const productId = btn.dataset.productId;
  if (!productId) return;

  try {
    const result = await API.toggleFavorite(productId);
    const icon = btn.querySelector("i");

    if (result.favorited) {
      btn.classList.add("active");
      icon.classList.remove("fa-regular");
      icon.classList.add("fa-solid");
      btn.title = "Remover dos favoritos";
      if (typeof showToast === "function") {
        showToast("Adicionado aos favoritos!", "success");
      }
    } else {
      btn.classList.remove("active");
      icon.classList.remove("fa-solid");
      icon.classList.add("fa-regular");
      btn.title = "Adicionar aos favoritos";
      if (typeof showToast === "function") {
        showToast("Removido dos favoritos.", "success");
      }
    }
  } catch (err) {
    console.error("Erro ao toggle favorito:", err);
    if (typeof showToast === "function") {
      showToast("Erro ao atualizar favorito.", "error");
    }
  }
};
