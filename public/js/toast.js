/* ================================================================
   MOVE PLUS — Global Toast & Confirm System
   ================================================================
   Usage (any page after including this script):

     Toast.success("Produto guardado!");
     Toast.error("Erro ao guardar.");
     Toast.warning("Tens a certeza?");
     Toast.info("Sessão iniciada.");

     // Replaces alert()
     Toast.alert("Acesso negado.");

     // Replaces confirm() — returns Promise<boolean>
     const ok = await Toast.confirm("Eliminar produto?");
     if (ok) { ... }

     // Custom duration (ms)
     Toast.success("Feito!", { duration: 5000 });

   ================================================================ */

(function () {
  "use strict";

  /* ─── Inject styles once ─────────────────────────────────── */
  const CSS = `
    /* ── Toast Container ── */
    #mp-toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;         /* Maximum possible z-index */
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      width: 340px;
      max-width: calc(100vw - 40px);
    }

    /* ── Individual Toast ── */
    .mp-toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      background: #1c1410;
      color: #f5e6c8;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      font-size: 0.875rem;
      line-height: 1.45;
      box-shadow:
        0 8px 32px rgba(0,0,0,0.45),
        0 2px 8px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(16px);
      pointer-events: all;
      cursor: default;
      animation: mpSlideIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
      position: relative;
      overflow: hidden;
      will-change: transform, opacity;
    }

    .mp-toast.mp-toast--exit {
      animation: mpSlideOut 0.28s cubic-bezier(0.55, 0, 1, 0.45) both;
    }

    /* ── Left accent bar ── */
    .mp-toast::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      border-radius: 12px 0 0 12px;
    }

    /* ── Progress bar ── */
    .mp-toast__progress {
      position: absolute;
      bottom: 0; left: 0;
      height: 3px;
      border-radius: 0 0 12px 12px;
      transform-origin: left;
      animation: mpProgress linear both;
    }

    /* ── Icon ── */
    .mp-toast__icon {
      font-size: 1.15rem;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* ── Body ── */
    .mp-toast__body {
      flex: 1;
      min-width: 0;
    }
    .mp-toast__title {
      font-weight: 600;
      margin-bottom: 2px;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.7;
    }
    .mp-toast__msg {
      word-break: break-word;
    }

    /* ── Close button ── */
    .mp-toast__close {
      background: none;
      border: none;
      color: inherit;
      opacity: 0.45;
      cursor: pointer;
      font-size: 1rem;
      padding: 0;
      flex-shrink: 0;
      line-height: 1;
      margin-top: 1px;
      transition: opacity 0.15s;
    }
    .mp-toast__close:hover { opacity: 0.9; }

    /* ── Type variants ── */
    .mp-toast--success::before { background: #22c55e; }
    .mp-toast--success .mp-toast__progress { background: #22c55e; }
    .mp-toast--success .mp-toast__icon { color: #22c55e; }

    .mp-toast--error::before { background: #ef4444; }
    .mp-toast--error .mp-toast__progress { background: #ef4444; }
    .mp-toast--error .mp-toast__icon { color: #ef4444; }

    .mp-toast--warning::before { background: #f59e0b; }
    .mp-toast--warning .mp-toast__progress { background: #f59e0b; }
    .mp-toast--warning .mp-toast__icon { color: #f59e0b; }

    .mp-toast--info::before { background: #b8860b; }
    .mp-toast--info .mp-toast__progress { background: #b8860b; }
    .mp-toast--info .mp-toast__icon { color: #b8860b; }

    /* ── Animations ── */
    @keyframes mpSlideIn {
      from { opacity: 0; transform: translateX(110%); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes mpSlideOut {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(110%); }
    }
    @keyframes mpProgress {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }

    /* ── Confirm Modal ── */
    #mp-confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(6px);
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.22s ease;
      pointer-events: none;
    }
    #mp-confirm-overlay.open {
      opacity: 1;
      pointer-events: all;
    }
    #mp-confirm-box {
      background: #1c1410;
      border: 1px solid rgba(184,134,11,0.25);
      border-radius: 16px;
      padding: 28px 28px 24px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      transform: scale(0.92) translateY(16px);
      transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                  opacity  0.22s ease;
      opacity: 0;
      font-family: 'Inter', 'Segoe UI', sans-serif;
    }
    #mp-confirm-overlay.open #mp-confirm-box {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    #mp-confirm-icon {
      font-size: 2.2rem;
      margin-bottom: 12px;
      display: block;
    }
    #mp-confirm-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #f5e6c8;
      margin: 0 0 8px;
    }
    #mp-confirm-msg {
      font-size: 0.9rem;
      color: rgba(245,230,200,0.7);
      line-height: 1.5;
      margin: 0 0 24px;
    }
    .mp-confirm-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .mp-confirm-actions button {
      padding: 9px 20px;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: opacity 0.15s, transform 0.1s;
      font-family: inherit;
    }
    .mp-confirm-actions button:active { transform: scale(0.97); }
    #mp-confirm-yes {
      background: #ef4444;
      color: #fff;
    }
    #mp-confirm-yes.safe { background: #22c55e; }
    #mp-confirm-no {
      background: rgba(255,255,255,0.08);
      color: rgba(245,230,200,0.8);
      border: 1px solid rgba(255,255,255,0.1);
    }
    #mp-confirm-no:hover, #mp-confirm-yes:hover { opacity: 0.85; }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      #mp-toast-container {
        top: 12px; right: 12px; left: 12px;
        width: auto;
      }
    }
  `;

  const styleEl = document.createElement("style");
  styleEl.id = "mp-toast-styles";
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ─── Create container ───────────────────────────────────── */
  const container = document.createElement("div");
  container.id = "mp-toast-container";
  document.body.appendChild(container);

  /* ─── Create confirm overlay ─────────────────────────────── */
  const overlay = document.createElement("div");
  overlay.id = "mp-confirm-overlay";
  overlay.innerHTML = `
    <div id="mp-confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="mp-confirm-title" aria-describedby="mp-confirm-msg">
      <span id="mp-confirm-icon">⚠️</span>
      <p id="mp-confirm-title">Confirmar Acção</p>
      <p id="mp-confirm-msg"></p>
      <div class="mp-confirm-actions">
        <button id="mp-confirm-no">Cancelar</button>
        <button id="mp-confirm-yes">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  /* ─── Toast icons ────────────────────────────────────────── */
  const ICONS = {
    success: '<i class="fa-solid fa-circle-check"></i>',
    error:   '<i class="fa-solid fa-circle-xmark"></i>',
    warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
    info:    '<i class="fa-solid fa-circle-info"></i>',
  };
  const LABELS = {
    success: "Sucesso",
    error:   "Erro",
    warning: "Atenção",
    info:    "Informação",
  };

  /* ─── Core show function ─────────────────────────────────── */
  let _toastId = 0;

  function _show(type, msg, options = {}) {
    const duration = options.duration ?? (type === "error" ? 5000 : 3500);
    const id = ++_toastId;

    const el = document.createElement("div");
    el.className = `mp-toast mp-toast--${type}`;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    el.innerHTML = `
      <span class="mp-toast__icon">${ICONS[type] || ICONS.info}</span>
      <div class="mp-toast__body">
        <div class="mp-toast__title">${LABELS[type] || "Aviso"}</div>
        <div class="mp-toast__msg">${msg}</div>
      </div>
      <button class="mp-toast__close" aria-label="Fechar" title="Fechar">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="mp-toast__progress" style="animation-duration:${duration}ms"></div>
    `;

    container.appendChild(el);

    // Auto-dismiss
    let timer = setTimeout(() => _dismiss(el), duration);

    // Manual close
    el.querySelector(".mp-toast__close").addEventListener("click", () => {
      clearTimeout(timer);
      _dismiss(el);
    });

    // Pause on hover
    el.addEventListener("mouseenter", () => {
      clearTimeout(timer);
      el.querySelector(".mp-toast__progress").style.animationPlayState = "paused";
    });
    el.addEventListener("mouseleave", () => {
      el.querySelector(".mp-toast__progress").style.animationPlayState = "running";
      timer = setTimeout(() => _dismiss(el), 1200);
    });

    return id;
  }

  function _dismiss(el) {
    if (!el || !el.parentNode) return;
    el.classList.add("mp-toast--exit");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  /* ─── Confirm dialog ─────────────────────────────────────── */
  let _confirmResolve = null;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) _closeConfirm(false);
  });
  document.getElementById("mp-confirm-yes").addEventListener("click", () => _closeConfirm(true));
  document.getElementById("mp-confirm-no").addEventListener("click",  () => _closeConfirm(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) _closeConfirm(false);
  });

  function _closeConfirm(result) {
    overlay.classList.remove("open");
    if (_confirmResolve) {
      _confirmResolve(result);
      _confirmResolve = null;
    }
  }

  function _confirm(msg, options = {}) {
    const title   = options.title   ?? "Confirmar Acção";
    const icon    = options.icon    ?? "⚠️";
    const yesText = options.yesText ?? "Confirmar";
    const noText  = options.noText  ?? "Cancelar";
    const safe    = options.safe    ?? false;   // green confirm button

    document.getElementById("mp-confirm-icon").textContent  = icon;
    document.getElementById("mp-confirm-title").textContent = title;
    document.getElementById("mp-confirm-msg").textContent   = msg;

    const yesBtn = document.getElementById("mp-confirm-yes");
    yesBtn.textContent = yesText;
    yesBtn.className   = safe ? "safe" : "";

    document.getElementById("mp-confirm-no").textContent = noText;

    overlay.classList.add("open");

    // Focus the cancel button by default (safer)
    setTimeout(() => document.getElementById("mp-confirm-no")?.focus(), 50);

    return new Promise((resolve) => { _confirmResolve = resolve; });
  }

  /* ─── Public API ─────────────────────────────────────────── */
  window.Toast = {
    success: (msg, opts) => _show("success", msg, opts),
    error:   (msg, opts) => _show("error",   msg, opts),
    warning: (msg, opts) => _show("warning", msg, opts),
    info:    (msg, opts) => _show("info",    msg, opts),

    /** Drop-in replacement for alert() */
    alert: (msg, opts)   => _show("warning", msg, { duration: 6000, ...opts }),

    /** Drop-in replacement for confirm() — returns Promise<boolean> */
    confirm: (msg, opts) => _confirm(msg, opts),

    /** Shorthand for delete confirmations */
    confirmDelete: (itemName) => _confirm(
      `Tens a certeza que queres eliminar${itemName ? ` "${itemName}"` : " este item"}? Esta acção não pode ser revertida.`,
      { title: "Eliminar", icon: "🗑️", yesText: "Sim, eliminar", noText: "Cancelar" }
    ),
  };

  /* ─── Backwards-compat: showToast(msg, type) ─────────────── */
  window.showToast = (msg, type = "info") => window.Toast[type]?.(msg) ?? window.Toast.info(msg);

})();
