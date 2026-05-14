/* Accessibility widget — IS 5568 / WCAG 2.0 AA aligned controls.
   Self-contained, no third-party calls. State persists in localStorage.
   The page contents are wrapped in a `.a11y-page` div so visual filters
   (grayscale / invert) don't pull the floating button into a new
   containing block — fixes the "button disappears on scroll" bug.      */
(function () {
  if (window.__kwotlyA11y) return;
  window.__kwotlyA11y = true;

  const STORAGE = "kwotly-a11y";
  const defaults = {
    fontStep: 0,
    contrast: false,
    invert: false,
    grayscale: false,
    highlightLinks: false,
    underlineLinks: false,
    readableFont: false,
    bigCursor: false,
    pauseMotion: false,
  };

  let state = Object.assign({}, defaults);
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (_) {}

  const css = `
    .a11y-skip {
      position: fixed; top: 0; right: 0;
      padding: 12px 18px;
      background: #1b5fff; color: #fff;
      font-family: 'Heebo', system-ui, sans-serif;
      font-weight: 700; font-size: 14px;
      text-decoration: none;
      border-radius: 0 0 0 12px;
      transform: translateY(-150%);
      transition: transform 0.18s ease;
      z-index: 100000;
    }
    .a11y-skip:focus {
      transform: translateY(0);
      outline: 3px solid #ffd34d;
      outline-offset: 2px;
    }

    .a11y-fab {
      position: fixed; bottom: 20px; left: 20px;
      width: 56px; height: 56px;
      border-radius: 50%; border: 0;
      background: linear-gradient(135deg, #1b5fff, #3b8fff);
      color: #fff; cursor: pointer;
      display: grid; place-items: center;
      box-shadow: 0 12px 28px -8px rgba(27,61,255,0.55), 0 4px 10px -4px rgba(27,61,255,0.35);
      z-index: 99998;
      transition: transform 0.2s ease;
    }
    .a11y-fab:hover { transform: scale(1.06); }
    .a11y-fab:focus-visible { outline: 3px solid #ffd34d; outline-offset: 2px; }
    .a11y-fab svg { width: 28px; height: 28px; }

    .a11y-panel {
      position: fixed; bottom: 88px; left: 20px;
      width: 320px; max-width: calc(100vw - 40px);
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      background: #fff; color: #0B0B14;
      border-radius: 18px;
      border: 1px solid rgba(11,11,20,0.10);
      box-shadow: 0 24px 60px -20px rgba(20,30,80,0.30), 0 8px 22px -8px rgba(20,30,80,0.15);
      padding: 16px;
      font-family: 'Heebo', 'Manrope', system-ui, sans-serif;
      z-index: 99999;
      direction: rtl;
      display: none;
    }
    .a11y-panel[data-open="1"] { display: block; }
    .a11y-panel h2 {
      margin: 0 0 4px;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .a11y-panel .a11y-sub {
      font-size: 12px; color: rgba(11,11,20,0.62);
      margin-bottom: 14px;
    }
    .a11y-panel .a11y-section-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(11,11,20,0.50);
      margin: 14px 0 6px;
    }
    .a11y-panel .a11y-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .a11y-panel button.a11y-opt {
      appearance: none;
      border: 1px solid rgba(11,11,20,0.10);
      background: #f6f7fb;
      border-radius: 12px;
      padding: 10px 8px;
      font-size: 12.5px;
      font-weight: 600;
      color: #0B0B14;
      cursor: pointer;
      text-align: center;
      line-height: 1.25;
      transition: background 0.15s ease, border-color 0.15s ease;
      font-family: inherit;
    }
    .a11y-panel button.a11y-opt:hover { background: #eef0f8; }
    .a11y-panel button.a11y-opt:focus-visible { outline: 2px solid #1b5fff; outline-offset: 2px; }
    .a11y-panel button.a11y-opt[aria-pressed="true"] {
      background: rgba(27,95,255,0.12);
      border-color: #1b5fff;
      color: #1b5fff;
    }
    .a11y-panel .a11y-row {
      display: flex; gap: 8px;
    }
    .a11y-panel .a11y-row button {
      flex: 1;
      appearance: none; border: 1px solid rgba(11,11,20,0.10);
      background: #f6f7fb;
      border-radius: 12px;
      padding: 10px;
      font-size: 14px; font-weight: 700;
      cursor: pointer;
      color: #0B0B14;
      font-family: inherit;
    }
    .a11y-panel .a11y-row button:hover { background: #eef0f8; }
    .a11y-panel .a11y-row button:focus-visible { outline: 2px solid #1b5fff; outline-offset: 2px; }
    .a11y-panel .a11y-step {
      flex: 1; text-align: center;
      padding: 10px 0; border-radius: 12px;
      background: rgba(27,95,255,0.10);
      color: #1b5fff; font-weight: 700; font-size: 13px;
    }
    .a11y-panel .a11y-actions {
      display: flex;
      gap: 8px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(11,11,20,0.08);
    }
    .a11y-panel .a11y-reset {
      flex: 1;
      appearance: none; border: 1px solid rgba(11,11,20,0.12);
      background: #fff; color: #0B0B14;
      border-radius: 10px; padding: 9px;
      font-size: 12.5px; font-weight: 600;
      cursor: pointer; font-family: inherit;
    }
    .a11y-panel .a11y-reset:hover { background: #f6f7fb; }
    .a11y-panel .a11y-statement {
      flex: 1; text-align: center;
      font-size: 12.5px; font-weight: 600;
      color: #1b5fff; text-decoration: none;
      border: 1px solid rgba(27,95,255,0.30);
      border-radius: 10px;
      padding: 9px;
      background: rgba(27,95,255,0.06);
    }
    .a11y-panel .a11y-statement:hover { background: rgba(27,95,255,0.12); }

    /* keyboard focus indicator across the site */
    .a11y-page a:focus-visible,
    .a11y-page button:focus-visible,
    .a11y-page input:focus-visible,
    .a11y-page select:focus-visible,
    .a11y-page textarea:focus-visible,
    .a11y-page [tabindex]:focus-visible {
      outline: 3px solid #1b5fff !important;
      outline-offset: 2px !important;
      border-radius: 4px;
    }

    /* ── modes — scoped to .a11y-page wrapper, NOT body ───────────── */
    .a11y-page[data-a11y-contrast="1"] {
      background: #000 !important;
      color: #fff !important;
    }
    .a11y-page[data-a11y-contrast="1"] * {
      background-color: transparent !important;
      background-image: none !important;
      color: #fff !important;
      border-color: #fff !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    .a11y-page[data-a11y-contrast="1"] a,
    .a11y-page[data-a11y-contrast="1"] a * { color: #ffd34d !important; }
    .a11y-page[data-a11y-contrast="1"] img { filter: brightness(0.9) contrast(1.1); }

    .a11y-page[data-a11y-invert="1"] {
      filter: invert(1) hue-rotate(180deg);
    }
    .a11y-page[data-a11y-invert="1"] img,
    .a11y-page[data-a11y-invert="1"] video,
    .a11y-page[data-a11y-invert="1"] picture {
      filter: invert(1) hue-rotate(180deg);
    }

    .a11y-page[data-a11y-grayscale="1"] {
      filter: grayscale(1);
    }

    .a11y-page[data-a11y-links="1"] a {
      background: #ffd34d !important;
      color: #0B0B14 !important;
      padding: 0 3px !important;
      border-radius: 3px !important;
    }
    .a11y-page[data-a11y-underline="1"] a {
      text-decoration: underline !important;
      text-underline-offset: 3px !important;
      text-decoration-thickness: 2px !important;
    }

    .a11y-page[data-a11y-readable="1"],
    .a11y-page[data-a11y-readable="1"] * {
      font-family: Arial, 'Heebo', sans-serif !important;
      letter-spacing: 0 !important;
      font-style: normal !important;
      text-shadow: none !important;
    }

    .a11y-page[data-a11y-bigcursor="1"],
    .a11y-page[data-a11y-bigcursor="1"] * {
      cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><polygon points='4,2 4,38 14,28 20,42 26,38 20,28 32,28' fill='%23000' stroke='%23fff' stroke-width='2.5' stroke-linejoin='round'/></svg>") 2 2, auto !important;
    }

    .a11y-page[data-a11y-motion="1"] *,
    .a11y-page[data-a11y-motion="1"] *::before,
    .a11y-page[data-a11y-motion="1"] *::after {
      animation-duration: 0.001s !important;
      animation-delay: 0s !important;
      transition-duration: 0.001s !important;
      transition-delay: 0s !important;
      scroll-behavior: auto !important;
    }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const skipLink = document.createElement("a");
  skipLink.className = "a11y-skip";
  skipLink.href = "#main";
  skipLink.textContent = "דלג לתוכן הראשי";

  const fab = document.createElement("button");
  fab.className = "a11y-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "פתיחת תפריט נגישות");
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-controls", "a11y-panel");
  fab.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="4" r="2"/>
      <path d="M19 8c-3 1-5 1-7 1s-4 0-7-1"/>
      <path d="M9 11l1 4-2 6"/>
      <path d="M15 11l-1 4 2 6"/>
    </svg>`;

  const panel = document.createElement("div");
  panel.className = "a11y-panel";
  panel.id = "a11y-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "אפשרויות נגישות");
  panel.innerHTML = `
    <h2>נגישות</h2>
    <div class="a11y-sub">בהתאם לתקן ישראלי 5568 (WCAG 2.0 AA)</div>

    <div class="a11y-section-label">גודל טקסט</div>
    <div class="a11y-row" data-a11y-font>
      <button type="button" data-action="font-down" aria-label="הקטנת טקסט">‑ א</button>
      <div class="a11y-step" aria-live="polite" data-step>100%</div>
      <button type="button" data-action="font-up" aria-label="הגדלת טקסט">+ א</button>
    </div>

    <div class="a11y-section-label">תצוגה</div>
    <div class="a11y-grid">
      <button type="button" class="a11y-opt" data-key="contrast" aria-pressed="false">ניגודיות גבוהה</button>
      <button type="button" class="a11y-opt" data-key="invert" aria-pressed="false">ניגודיות הפוכה</button>
      <button type="button" class="a11y-opt" data-key="grayscale" aria-pressed="false">גווני אפור</button>
      <button type="button" class="a11y-opt" data-key="readableFont" aria-pressed="false">פונט קריא</button>
    </div>

    <div class="a11y-section-label">קישורים וניווט</div>
    <div class="a11y-grid">
      <button type="button" class="a11y-opt" data-key="highlightLinks" aria-pressed="false">סימון קישורים</button>
      <button type="button" class="a11y-opt" data-key="underlineLinks" aria-pressed="false">קו תחתי בקישורים</button>
      <button type="button" class="a11y-opt" data-key="bigCursor" aria-pressed="false">סמן מוגדל</button>
      <button type="button" class="a11y-opt" data-key="pauseMotion" aria-pressed="false">עצירת אנימציות</button>
    </div>

    <div class="a11y-actions">
      <button type="button" class="a11y-reset" data-action="reset">איפוס הגדרות</button>
      <a class="a11y-statement" href="/accessibility-statement/">הצהרת נגישות</a>
    </div>
  `;

  let wrapper = null;

  function persist() {
    try {
      const toStore = {};
      Object.keys(defaults).forEach((k) => { toStore[k] = state[k]; });
      localStorage.setItem(STORAGE, JSON.stringify(toStore));
    } catch (_) {}
  }

  function apply() {
    if (!wrapper) return;
    const scale = 1 + state.fontStep * 0.10;
    document.documentElement.style.fontSize = state.fontStep === 0 ? "" : `${Math.round(scale * 100)}%`;
    wrapper.dataset.a11yContrast  = state.contrast       ? "1" : "";
    wrapper.dataset.a11yInvert    = state.invert         ? "1" : "";
    wrapper.dataset.a11yGrayscale = state.grayscale      ? "1" : "";
    wrapper.dataset.a11yLinks     = state.highlightLinks ? "1" : "";
    wrapper.dataset.a11yUnderline = state.underlineLinks ? "1" : "";
    wrapper.dataset.a11yReadable  = state.readableFont   ? "1" : "";
    wrapper.dataset.a11yBigcursor = state.bigCursor      ? "1" : "";
    wrapper.dataset.a11yMotion    = state.pauseMotion    ? "1" : "";

    panel.querySelectorAll(".a11y-opt").forEach((b) => {
      const k = b.dataset.key;
      b.setAttribute("aria-pressed", state[k] ? "true" : "false");
    });
    const stepEl = panel.querySelector("[data-step]");
    if (stepEl) stepEl.textContent = `${Math.round(scale * 100)}%`;
  }

  function setOpen(open) {
    panel.setAttribute("data-open", open ? "1" : "");
    fab.setAttribute("aria-expanded", open ? "true" : "false");
  }

  fab.addEventListener("click", () => {
    setOpen(panel.getAttribute("data-open") !== "1");
  });

  panel.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const action = t.dataset.action;
    if (action === "font-up")     state.fontStep = Math.min(5, state.fontStep + 1);
    else if (action === "font-down") state.fontStep = Math.max(-2, state.fontStep - 1);
    else if (action === "reset")  state = Object.assign({}, defaults);
    else if (t.dataset.key)       state[t.dataset.key] = !state[t.dataset.key];
    else return;
    persist();
    apply();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.getAttribute("data-open") === "1") {
      setOpen(false);
      fab.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (panel.getAttribute("data-open") !== "1") return;
    if (panel.contains(e.target) || fab.contains(e.target)) return;
    setOpen(false);
  });

  function mount() {
    wrapper = document.createElement("div");
    wrapper.className = "a11y-page";
    while (document.body.firstChild) {
      wrapper.appendChild(document.body.firstChild);
    }
    document.body.appendChild(wrapper);

    document.body.insertBefore(skipLink, wrapper);
    document.body.appendChild(fab);
    document.body.appendChild(panel);

    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
