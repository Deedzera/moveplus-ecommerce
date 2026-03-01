/* ============================================
   MOVE PLUS — Resolução de Cookies Banner
   ============================================ */

document.addEventListener("DOMContentLoaded", function () {
  const consentLabel = "moveplus_cookie_consent";
  
  // Se já foi respondido, não mostra
  if (localStorage.getItem(consentLabel)) return;

  // Usa caminhos dinâmicos dependendo se estamos na raiz ou não
  const isInPagesDir = window.location.pathname.includes('/pages/');
  
  // HTML do Banner
  const bannerHTML = `
    <div id="cookieConsentBanner" class="cookie-banner">
      <div class="cookie-banner__content">
        <div class="cookie-banner__icon"><i class="fa-solid fa-cookie-bite"></i></div>
        <div class="cookie-banner__text">
          <h3>Nós valorizamos a tua privacidade</h3>
          <p>Utilizamos cookies para melhorar a tua experiência, analisar o tráfego do site e apresentar conteúdo personalizado. Escolhe os cookies que desejas aceitar.</p>
        </div>
      </div>
      <div class="cookie-banner__actions">
        <button id="btnDeclineCookies" class="btn-cookie btn-cookie--outline">Rejeitar</button>
        <button id="btnAcceptCookies" class="btn-cookie btn-cookie--solid">Aceitar Todos</button>
      </div>
    </div>
  `;

  // CSS dinâmico
  const styles = `
    .cookie-banner {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(150%);
      width: 90%;
      max-width: 800px;
      background: var(--bg-card, #1c1c1c); /* fallback for dark mode */
      color: var(--text-color, #e5e5e5);
      border: 1px solid var(--border-color, #333);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 20px;
      opacity: 0;
      transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease;
    }
    
    html.light .cookie-banner {
      background: #ffffff;
      color: #333333;
      border: 1px solid #e0e0e0;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }

    .cookie-banner.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    @media (min-width: 768px) {
      .cookie-banner {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }

    .cookie-banner__content {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .cookie-banner__icon {
      font-size: 2rem;
      color: var(--gold, #c19f5f);
      margin-top: 4px;
    }
    
    .cookie-banner__text h3 {
      font-size: 1.1rem;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .cookie-banner__text p {
      font-size: 0.9rem;
      color: var(--text-muted, #a0a0a0);
      line-height: 1.5;
      margin: 0;
    }
    
    html.light .cookie-banner__text p {
      color: #666;
    }

    .cookie-banner__actions {
      display: flex;
      gap: 12px;
      flex-shrink: 0;
      width: 100%;
    }

    @media (min-width: 768px) {
      .cookie-banner__actions {
        width: auto;
      }
    }

    .btn-cookie {
      flex: 1;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      border: none;
    }

    .btn-cookie--outline {
      background: transparent;
      color: var(--text-color, #e5e5e5);
      border: 1px solid var(--border-color, #444);
    }
    
    html.light .btn-cookie--outline {
      color: #333;
      border: 1px solid #ccc;
    }

    .btn-cookie--outline:hover {
      background: var(--bg-hover, #2a2a2a);
    }
    
    html.light .btn-cookie--outline:hover {
      background: #f5f5f5;
    }

    .btn-cookie--solid {
      background: var(--gold, #c19f5f);
      color: #000;
    }

    .btn-cookie--solid:hover {
      background: #d4b572;
      transform: translateY(-2px);
    }
  `;

  // Inserir CSS
  const styleEl = document.createElement("style");
  styleEl.innerHTML = styles;
  document.head.appendChild(styleEl);

  // Inserir Banner
  const wrapper = document.createElement("div");
  wrapper.innerHTML = bannerHTML;
  document.body.appendChild(wrapper.firstElementChild);

  const banner = document.getElementById("cookieConsentBanner");
  
  // Animar entrada após 1.5s
  setTimeout(() => {
    banner.classList.add("show");
  }, 1500);

  // Handlers
  document.getElementById("btnAcceptCookies").addEventListener("click", () => {
    localStorage.setItem(consentLabel, "accepted");
    closeBanner();
  });

  document.getElementById("btnDeclineCookies").addEventListener("click", () => {
    localStorage.setItem(consentLabel, "declined");
    closeBanner();
  });

  function closeBanner() {
    banner.classList.remove("show");
    setTimeout(() => {
      banner.remove();
    }, 500);
  }
});
