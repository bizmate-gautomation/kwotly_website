/* Liquid-glass — physics-based refraction + cursor-tracking specular highlight.
   Technique from kube.io/blog/liquid-glass-css-svg/
   Chrome-only (backdrop-filter: url(#id)). Safari/Firefox keep CSS fallback.

   Two modes:
     .glass         — edge-bezel refraction (squircle profile, bezel zone only)
     .glass-bubble  — full spherical-cap dome (whole surface acts as convex lens)

   The specular pass uses SVG feSpecularLighting on a baked height map. Light
   azimuth is updated on pointermove so the rim glow follows the cursor.
*/
(function () {

  function supports() {
    if (!CSS || !CSS.supports) return false;
    return CSS.supports("backdrop-filter", "url(#x)") ||
           CSS.supports("-webkit-backdrop-filter", "url(#x)");
  }
  if (!supports()) return;

  /* ── Squircle profile derivative ───────────────────────────────────
     f(t) = (1-(1-t)^4)^(1/4) — Apple's preferred lens cross-section.
     f'(t) = (1-t)^3 / (1-(1-t)^4)^(3/4),  t ∈ [0,1]               */
  function squircleDeriv(t) {
    t = Math.max(1e-4, Math.min(1 - 1e-4, t));
    const u = 1 - t;
    const u4 = u * u * u * u;
    const denom = Math.pow(1 - u4, 0.75);
    return denom < 1e-5 ? 50 : (u * u * u) / denom;
  }

  /* Squircle height profile itself (z value, 0 at rim → 1 at interior). */
  function squircleZ(t) {
    t = Math.max(0, Math.min(1, t));
    const u = 1 - t;
    return Math.pow(1 - u * u * u * u, 0.25);
  }

  /* ── Refraction magnitude table (bezel mode) ────────────────────── */
  function refractTable(bezel) {
    const N = bezel + 1;
    const table = new Array(N);
    let max = 0;
    for (let i = 0; i < N; i++) {
      const t = i / bezel;
      const slope = squircleDeriv(t);
      const a1 = Math.atan(slope);
      const sinA2 = Math.min(1, Math.sin(a1) / 1.5);
      const a2 = Math.asin(sinA2);
      const d = Math.tan(a1) - Math.tan(a2);
      table[i] = d;
      if (d > max) max = d;
    }
    return { table, max };
  }

  /* ── Per-pixel border geometry (bezel mode) ─────────────────────── */
  function borderInfo(px, py, w, h, radius) {
    const ix = Math.max(radius, Math.min(w - radius, px));
    const iy = Math.max(radius, Math.min(h - radius, py));
    const dx = px - ix, dy = py - iy;
    if (dx !== 0 || dy !== 0) {
      const d = Math.sqrt(dx * dx + dy * dy);
      return { dist: radius - d, nx: dx / d, ny: dy / d };
    }
    const dl = px, dr = w - px, dt = py, db = h - py;
    const m = Math.min(dl, dr, dt, db);
    let nx = 0, ny = 0;
    if      (m === dl) nx = -1;
    else if (m === dr) nx =  1;
    else if (m === dt) ny = -1;
    else               ny =  1;
    return { dist: m, nx, ny };
  }

  /* ════════════════════════════════════════════════════════════════════
     BEZEL MODE — edge-only squircle refraction
  ════════════════════════════════════════════════════════════════════ */

  function buildDisplacementMap(w, h, radius, bezel) {
    const { table, max } = refractTable(bezel);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const img = c.getContext("2d").createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const { dist, nx, ny } = borderInfo(x, y, w, h, radius);
        let r = 128, g = 128;
        if (dist >= 0 && dist < bezel) {
          const s = table[Math.min(bezel, Math.round(dist))];
          const fx = -nx * s / max;
          const fy = -ny * s / max;
          r = Math.max(0, Math.min(255, Math.round(128 + fx * 127)));
          g = Math.max(0, Math.min(255, Math.round(128 + fy * 127)));
        }
        d[i] = r; d[i+1] = g; d[i+2] = 128; d[i+3] = 255;
      }
    }
    c.getContext("2d").putImageData(img, 0, 0);
    return { url: c.toDataURL("image/png"), scale: max };
  }

  /* Height map for bezel mode — alpha = z(x,y), feSpecularLighting input. */
  function buildHeightMap(w, h, radius, bezel) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const img = c.getContext("2d").createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const { dist } = borderInfo(x, y, w, h, radius);
        let z = 0;
        if (dist >= bezel) z = 1;
        else if (dist >= 0) z = squircleZ(dist / bezel);
        d[i] = 255; d[i+1] = 255; d[i+2] = 255;
        d[i+3] = Math.round(z * 255);
      }
    }
    c.getContext("2d").putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  /* ════════════════════════════════════════════════════════════════════
     BUBBLE MODE — full spherical-cap dome over the pill surface
  ════════════════════════════════════════════════════════════════════ */

  function pillInfo(px, py, w, h) {
    const hh = h / 2;
    const cx = px - w / 2;
    const cy = py - h / 2;
    const lineHalf = w / 2 - hh;
    const nearX = Math.max(-lineHalf, Math.min(lineHalf, cx));
    const rdx = cx - nearX, rdy = cy;
    const r = Math.sqrt(rdx * rdx + rdy * rdy) / hh;
    return { r, rdx, rdy, hh };
  }

  const BUBBLE_DOME = 0.65;

  function buildBubbleDomeMap(w, h) {
    const DOME = BUBBLE_DOME;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const img = c.getContext("2d").createImageData(w, h);
    const d = img.data;
    const raw = new Float32Array(w * h * 2);
    let maxDisp = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pi = (y * w + x) * 2;
        const { r, rdx, rdy, hh } = pillInfo(x, y, w, h);
        if (r >= 1) { raw[pi] = 0; raw[pi+1] = 0; continue; }

        const dzdr = r < 1e-3 ? 0 : -DOME * r / Math.sqrt(1 - r * r);
        const nxR = -(dzdr) * (rdx / hh);
        const nyR = -(dzdr) * (rdy / hh);
        const nLen = Math.sqrt(nxR * nxR + nyR * nyR + 1);
        const nx = nxR / nLen;
        const ny = nyR / nLen;

        const nxy = Math.sqrt(nx * nx + ny * ny);
        if (nxy < 1e-6) { raw[pi] = 0; raw[pi+1] = 0; continue; }

        const a1 = Math.atan(nxy);
        const sinA2 = Math.min(1, Math.sin(a1) / 1.5);
        const a2 = Math.asin(sinA2);
        const mag = Math.tan(a1) - Math.tan(a2);

        const factor = mag / nxy;
        raw[pi]   = -nx * factor;
        raw[pi+1] = -ny * factor;
        if (mag > maxDisp) maxDisp = mag;
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i  = (y * w + x) * 4;
        const pi = (y * w + x) * 2;
        const fx = maxDisp > 0 ? raw[pi]   / maxDisp : 0;
        const fy = maxDisp > 0 ? raw[pi+1] / maxDisp : 0;
        d[i]   = Math.max(0, Math.min(255, Math.round(128 + fx * 127)));
        d[i+1] = Math.max(0, Math.min(255, Math.round(128 + fy * 127)));
        d[i+2] = 128; d[i+3] = 255;
      }
    }
    c.getContext("2d").putImageData(img, 0, 0);
    return { url: c.toDataURL("image/png"), scale: maxDisp };
  }

  /* Height map for bubble mode — alpha = sqrt(1-r²), normalized to 0..1. */
  function buildBubbleHeightMap(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const img = c.getContext("2d").createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const { r } = pillInfo(x, y, w, h);
        const z = r < 1 ? Math.sqrt(1 - r * r) : 0;
        d[i] = 255; d[i+1] = 255; d[i+2] = 255;
        d[i+3] = Math.round(z * 255);
      }
    }
    c.getContext("2d").putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  /* ════════════════════════════════════════════════════════════════════
     SHARED SVG HOST & PER-ELEMENT APPLY
  ════════════════════════════════════════════════════════════════════ */

  let host = document.getElementById("__lg-host");
  if (!host) {
    host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    host.setAttribute("id", "__lg-host");
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;visibility:visible";
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    host.appendChild(defs);
    document.body.appendChild(host);
  }
  const defs = host.querySelector("defs");

  /* Element → feDistantLight registry, used by the pointermove handler.    */
  const lightReg = new Map();

  function applyOne(el, i) {
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 8 || h < 8) return;

    const capW = Math.min(w, 1200);
    const capH = Math.min(h, 800);

    const cs = getComputedStyle(el);
    let radius = parseFloat(cs.borderRadius) || 24;
    radius = Math.min(radius, capW / 2, capH / 2);
    const bezel = Math.max(12, Math.min(36, Math.round(radius * 0.92)));
    const r = Math.round(radius);

    const isBubble = el.classList.contains("glass-bubble");
    const sig = `${capW}x${capH}r${r}b${bezel}${isBubble ? "B" : ""}`;
    if (el.dataset.lgSig === sig) return;
    el.dataset.lgSig = sig;

    /* Build maps — bubble mode vs edge-bezel mode */
    let dispUrl, dispScale, heightUrl;
    if (isBubble) {
      const bd = buildBubbleDomeMap(capW, capH);
      dispUrl   = bd.url;
      dispScale = bd.scale;
      heightUrl = buildBubbleHeightMap(capW, capH);
    } else {
      const ed = buildDisplacementMap(capW, capH, r, bezel);
      dispUrl   = ed.url;
      dispScale = ed.scale;
      heightUrl = buildHeightMap(capW, capH, r, bezel);
    }

    const id = `lg-${i}`;
    const prev = host.querySelector(`#${id}`);
    if (prev) prev.remove();

    const ns = "http://www.w3.org/2000/svg";
    const filt = document.createElementNS(ns, "filter");
    filt.setAttribute("id",     id);
    filt.setAttribute("x",      "0");
    filt.setAttribute("y",      "0");
    filt.setAttribute("width",  capW);
    filt.setAttribute("height", capH);
    filt.setAttribute("filterUnits", "userSpaceOnUse");
    filt.setAttribute("color-interpolation-filters", "sRGB");

    function feImg(url, result) {
      const fe = document.createElementNS(ns, "feImage");
      fe.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", url);
      fe.setAttribute("href", url);
      fe.setAttribute("x", "0");    fe.setAttribute("y", "0");
      fe.setAttribute("width",  capW);
      fe.setAttribute("height", capH);
      fe.setAttribute("preserveAspectRatio", "none");
      fe.setAttribute("result", result);
      return fe;
    }

    /* 1 — Displacement map */
    filt.appendChild(feImg(dispUrl, "dispMap"));

    /* 2 — Refraction */
    const feDisp = document.createElementNS(ns, "feDisplacementMap");
    feDisp.setAttribute("in",  "SourceGraphic");
    feDisp.setAttribute("in2", "dispMap");
    feDisp.setAttribute("scale", String(Math.round(dispScale * (isBubble ? 3.0 : 1.6))));
    feDisp.setAttribute("xChannelSelector", "R");
    feDisp.setAttribute("yChannelSelector", "G");
    feDisp.setAttribute("result", "refracted");
    filt.appendChild(feDisp);

    /* 3 — Saturation boost */
    const feSat = document.createElementNS(ns, "feColorMatrix");
    feSat.setAttribute("in",     "refracted");
    feSat.setAttribute("type",   "saturate");
    feSat.setAttribute("values", isBubble ? "1.6" : "1.5");
    feSat.setAttribute("result", "saturated");
    filt.appendChild(feSat);

    /* 4 — Height map (alpha = z) used by lighting */
    filt.appendChild(feImg(heightUrl, "heightMap"));

    /* 5 — Specular lighting from a distant light. The azimuth is updated on
       pointermove so the rim glow follows the cursor.                     */
    const feSL = document.createElementNS(ns, "feSpecularLighting");
    feSL.setAttribute("in", "heightMap");
    feSL.setAttribute("surfaceScale",     isBubble ? "12" : "8");
    feSL.setAttribute("specularConstant", "1.4");
    feSL.setAttribute("specularExponent", isBubble ? "22" : "38");
    feSL.setAttribute("lighting-color",   "#ffffff");
    feSL.setAttribute("result",           "specRaw");

    const feLight = document.createElementNS(ns, "feDistantLight");
    feLight.setAttribute("azimuth",   "225");
    feLight.setAttribute("elevation", "55");
    feSL.appendChild(feLight);
    filt.appendChild(feSL);

    /* 6 — Clip specular to the glass shape via the height map's alpha */
    const feClip = document.createElementNS(ns, "feComposite");
    feClip.setAttribute("in",       "specRaw");
    feClip.setAttribute("in2",      "heightMap");
    feClip.setAttribute("operator", "in");
    feClip.setAttribute("result",   "specular");
    filt.appendChild(feClip);

    /* 7 — Screen-blend specular onto the saturated refraction */
    const feBlend = document.createElementNS(ns, "feBlend");
    feBlend.setAttribute("in",   "saturated");
    feBlend.setAttribute("in2",  "specular");
    feBlend.setAttribute("mode", "screen");
    filt.appendChild(feBlend);

    defs.appendChild(filt);

    /* Register the light so the scroll handler can steer it. */
    lightReg.set(el, feLight);

    const blur = isBubble ? "0.3px" : "0.4px";
    const value = `url(#${id}) blur(${blur})`;
    el.style.backdropFilter = value;
    el.style.webkitBackdropFilter = value;
    el.classList.add("liquid-on");
  }

  function applyAll() {
    document.querySelectorAll(".glass").forEach((el, i) => applyOne(el, i));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyAll);
  } else {
    applyAll();
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    document.querySelectorAll(".glass").forEach(el => delete el.dataset.lgSig);
    resizeTimer = setTimeout(applyAll, 180);
  });

  /* ════════════════════════════════════════════════════════════════════
     SCROLL-DRIVEN LIGHTING
     The light is anchored in viewport space (a fixed virtual sun above the
     fold). As the user scrolls, each glass element's position relative to
     that anchor shifts, so the rim highlight slides — mimicking the
     perspective change you'd see tilting a real pane of glass.
  ════════════════════════════════════════════════════════════════════ */

  function lightAnchor() {
    /* Slightly above and centred on the viewport — a "sun" overhead. */
    return { ax: window.innerWidth / 2, ay: -window.innerHeight * 0.15 };
  }

  let pending = false;

  function refreshLights() {
    pending = false;
    const { ax, ay } = lightAnchor();
    lightReg.forEach((light, el) => {
      if (!el.isConnected) { lightReg.delete(el); return; }
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = ax - cx;
      let dy = ay - cy;
      if (dx === 0 && dy === 0) dx = 1;

      /* Azimuth: direction from the element toward the virtual sun.      */
      const az = Math.atan2(dy, dx) * 180 / Math.PI;

      /* Elevation falls off as the element scrolls away from the anchor —
         far elements catch a glancing light, near ones get a brighter rim. */
      const dist = Math.sqrt(dx * dx + dy * dy);
      const reach = window.innerHeight * 1.2;
      const proximity = Math.max(0, 1 - dist / reach);
      const elev = 25 + proximity * 40;

      light.setAttribute("azimuth",   az.toFixed(1));
      light.setAttribute("elevation", elev.toFixed(1));
    });
  }

  function scheduleRefresh() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(refreshLights);
  }

  window.addEventListener("scroll", scheduleRefresh, { passive: true });
  window.addEventListener("resize", scheduleRefresh, { passive: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRefresh);
  } else {
    scheduleRefresh();
  }

})();
