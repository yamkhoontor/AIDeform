/* Small canvas charting for the companion apps (no external libraries, works offline).
   Copyright (c) 2026 Yam Khoon Tor. All rights reserved. */
(function (G) {
  "use strict";
  const AD = G.AD || (G.AD = {});
  const COL = AD.colours = { blue: "#1f5a96", orange: "#c8551b", green: "#2e8b57", purple: "#7b3f9e", gold: "#b8860b", grey: "#666666",
    alert: "#e08a00", suspend: "#c62828", light: "#d6e4f2", faint: "#bbbbbb" };
  AD.series = [COL.blue, COL.orange, COL.green, COL.purple, COL.gold, COL.grey, "#17a2b8", "#8b4513", "#e377c2", "#7f7f7f", "#bcbd22", "#2ca02c"];

  function nice(lo, hi, n = 5) {
    if (!(hi > lo)) { hi = lo + 1; lo = lo - 1; }
    const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 0.5) || 10 * mag;
    const t0 = Math.ceil(lo / step - 1e-9) * step, ticks = [];
    for (let t = t0; t <= hi + step * 1e-9; t += step) ticks.push(Math.abs(t) < step * 1e-9 ? 0 : t);
    return { ticks, step };
  }
  const tickLabel = (t, step) => { const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); return t.toFixed(Math.min(d, 4)); };

  /* AD.plot(canvasOrSelector, spec)
     spec: { title, xlabel, ylabel, height, xlim:[a,b], ylim:[a,b], legend:true|"top", xticks:[{v,label}],
             series:[{x, y, type:"line"|"points"|"bar"|"band"|"step", y2(band), color, width, dash, label, size, alpha}],
             hlines:[{y,color,dash,label}], vlines:[{x,color,dash,label}], shade:[{x0,x1,color}], notes:[{x,y,text,align}] } */
  AD.plot = function (target, spec) {
    const cv = typeof target === "string" ? document.querySelector(target) : target;
    const W = Math.max(280, cv.parentElement.clientWidth || 600), H = spec.height || 300, dpr = G.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const dark = G.matchMedia && G.matchMedia("(prefers-color-scheme: dark)").matches && !document.documentElement.dataset.theme;
    const ink = getComputedStyle(document.body).getPropertyValue("--ink").trim() || (dark ? "#e6e6e6" : "#222");
    const grid = getComputedStyle(document.body).getPropertyValue("--grid").trim() || "rgba(128,128,128,0.25)";
    const series = (spec.series || []).filter((s) => s && s.x && s.x.length);
    // data range
    let xs = [], ys = [];
    for (const s of series) { xs.push(...s.x.filter(Number.isFinite)); ys.push(...s.y.filter(Number.isFinite)); if (s.y2) ys.push(...s.y2.filter(Number.isFinite)); }
    for (const h of spec.hlines || []) ys.push(h.y);
    let [x0, x1] = spec.xlim || [Math.min(...xs), Math.max(...xs)];
    let [y0, y1] = spec.ylim || [Math.min(...ys), Math.max(...ys)];
    if (!spec.ylim) { const pad = (y1 - y0 || 1) * 0.06; y0 -= pad; y1 += pad; }
    if (series.some((s) => s.type === "bar") && !spec.ylim) { y0 = Math.min(0, y0); y1 = Math.max(0, y1); }
    if (x1 === x0) { x0 -= 1; x1 += 1; }
    const yt = nice(y0, y1, Math.max(3, Math.round(H / 60)));
    if (!spec.ylim) { y0 = Math.min(y0, yt.ticks[0]); y1 = Math.max(y1, yt.ticks[yt.ticks.length - 1]); }
    g.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
    const ylabW = Math.max(...yt.ticks.map((t) => g.measureText(tickLabel(t, yt.step)).width));
    const legendTop = spec.legend === "top" && series.some((s) => s.label);
    const L = 18 + ylabW + (spec.ylabel ? 16 : 0), R = 14, T = (spec.title ? 24 : 10) + (legendTop ? 18 : 0), B = 30 + (spec.xlabel ? 16 : 0);
    const pw = W - L - R, ph = H - T - B;
    const X = (v) => L + (v - x0) / (x1 - x0) * pw, Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * ph;
    // shading
    for (const s of spec.shade || []) { g.fillStyle = s.color || "rgba(31,90,150,0.12)"; g.fillRect(X(Math.max(s.x0, x0)), T, X(Math.min(s.x1, x1)) - X(Math.max(s.x0, x0)), ph); }
    // grid and axes
    g.strokeStyle = grid; g.lineWidth = 1; g.fillStyle = ink; g.textAlign = "right"; g.textBaseline = "middle";
    for (const t of yt.ticks) { if (t < y0 - 1e-9 || t > y1 + 1e-9) continue; g.beginPath(); g.moveTo(L, Y(t)); g.lineTo(L + pw, Y(t)); g.stroke(); g.fillText(tickLabel(t, yt.step), L - 6, Y(t)); }
    g.textAlign = "center"; g.textBaseline = "top";
    if (spec.xticks) { for (const t of spec.xticks) { if (t.v < x0 || t.v > x1) continue; g.fillText(t.label, X(t.v), T + ph + 6); } }
    else { const xt = nice(x0, x1, Math.max(3, Math.round(pw / 80))); for (const t of xt.ticks) { if (t < x0 - 1e-9 || t > x1 + 1e-9) continue;
      g.beginPath(); g.moveTo(X(t), T); g.lineTo(X(t), T + ph); g.stroke(); g.fillText(tickLabel(t, xt.step), X(t), T + ph + 6); } }
    g.strokeStyle = ink; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(L, T); g.lineTo(L, T + ph); g.lineTo(L + pw, T + ph); g.stroke(); g.globalAlpha = 1;
    if (spec.xlabel) { g.fillText(spec.xlabel, L + pw / 2, T + ph + 22); }
    if (spec.ylabel) { g.save(); g.translate(12, T + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText(spec.ylabel, 0, 0); g.restore(); }
    if (spec.title) { g.textAlign = "left"; g.font = "600 13px system-ui, -apple-system, Segoe UI, sans-serif"; g.fillText(spec.title, L, 4); g.font = "12px system-ui, sans-serif"; }
    // clip to plot
    g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
    const nBars = series.filter((s) => s.type === "bar").length; let barIdx = 0;
    for (const s of series) {
      const c = s.color || AD.series[series.indexOf(s) % AD.series.length];
      g.strokeStyle = c; g.fillStyle = c; g.lineWidth = s.width || 1.6; g.setLineDash(s.dash || []); g.globalAlpha = s.alpha !== undefined ? s.alpha : 1;
      if (s.type === "band") {
        g.globalAlpha = s.alpha !== undefined ? s.alpha : 0.18; g.beginPath(); let started = false;
        for (let i = 0; i < s.x.length; i++) { if (!Number.isFinite(s.y[i])) continue; started ? g.lineTo(X(s.x[i]), Y(s.y[i])) : g.moveTo(X(s.x[i]), Y(s.y[i])); started = true; }
        for (let i = s.x.length - 1; i >= 0; i--) if (Number.isFinite(s.y2[i])) g.lineTo(X(s.x[i]), Y(s.y2[i]));
        g.closePath(); g.fill();
      } else if (s.type === "points") {
        const r = s.size || 2.5; for (let i = 0; i < s.x.length; i++) { if (!Number.isFinite(s.y[i])) continue; g.beginPath();
          if (s.hollow) { g.lineWidth = 1.5; g.arc(X(s.x[i]), Y(s.y[i]), r, 0, 7); g.stroke(); } else { g.arc(X(s.x[i]), Y(s.y[i]), r, 0, 7); g.fill(); } }
      } else if (s.type === "bar") {
        const dx = s.x.length > 1 ? Math.abs(s.x[1] - s.x[0]) : 1, bw = Math.max(1, (X(x0 + dx) - X(x0)) * 0.8 / nBars), off = (barIdx - (nBars - 1) / 2) * bw;
        for (let i = 0; i < s.x.length; i++) { if (!Number.isFinite(s.y[i])) continue; const fc = s.colors ? s.colors[i] : c; g.fillStyle = fc;
          const yb = Y(Math.max(0, Math.min(y1, 0))), yv = Y(s.y[i]); g.fillRect(X(s.x[i]) + off - bw / 2, Math.min(yb, yv), bw, Math.abs(yb - yv)); }
        barIdx++;
      } else {
        g.beginPath(); let pen = false;
        for (let i = 0; i < s.x.length; i++) { if (!Number.isFinite(s.y[i]) || !Number.isFinite(s.x[i])) { pen = false; continue; }
          const px = X(s.x[i]), py = Y(s.y[i]);
          if (!pen) { g.moveTo(px, py); pen = true; } else if (s.type === "step") { g.lineTo(px, Y(s.y[i - 1])); g.lineTo(px, py); } else g.lineTo(px, py); }
        g.stroke();
      }
      g.globalAlpha = 1; g.setLineDash([]);
    }
    for (const h of spec.hlines || []) { g.strokeStyle = h.color || COL.alert; g.lineWidth = h.width || 1.3; g.setLineDash(h.dash || [6, 4]); g.beginPath(); g.moveTo(L, Y(h.y)); g.lineTo(L + pw, Y(h.y)); g.stroke(); g.setLineDash([]);
      if (h.label) { g.fillStyle = h.color || COL.alert; g.textAlign = "left"; g.textBaseline = "bottom"; g.fillText(h.label, L + 6, Y(h.y) - 2); } }
    for (const v of spec.vlines || []) { g.strokeStyle = v.color || "#888"; g.lineWidth = v.width || 1.2; g.setLineDash(v.dash || [3, 3]); g.beginPath(); g.moveTo(X(v.x), T); g.lineTo(X(v.x), T + ph); g.stroke(); g.setLineDash([]);
      if (v.label) { g.fillStyle = v.color || "#666"; g.textAlign = v.align || "left"; g.textBaseline = "top"; g.fillText(v.label, X(v.x) + (v.align === "right" ? -4 : 4), T + 4 + (v.row || 0) * 14); } }
    for (const n of spec.notes || []) { g.fillStyle = n.color || ink; g.textAlign = n.align || "left"; g.textBaseline = "middle"; g.fillText(n.text, X(n.x), Y(n.y)); }
    g.restore();
    // legend
    const lab = series.filter((s) => s.label).concat((spec.hlines || []).filter((h) => h.legend).map((h) => ({ label: h.legend, color: h.color, dash: h.dash || [6, 4] })));
    if (spec.legend !== false && lab.length) {
      g.font = "12px system-ui, sans-serif"; g.textBaseline = "middle"; g.textAlign = "left";
      if (legendTop) { let x = L; const y = (spec.title ? 26 : 8) + 6;
        for (const s of lab) { drawKey(g, s, x, y); g.fillStyle = ink; g.fillText(s.label, x + 22, y); x += 30 + g.measureText(s.label).width; } }
      else { const w = Math.max(...lab.map((s) => g.measureText(s.label).width)) + 34, h = lab.length * 16 + 8;
        const pos = spec.legendPos || "tl"; const bx = pos.includes("r") ? L + pw - w - 6 : L + 6, by = pos.includes("b") ? T + ph - h - 6 : T + 6;
        g.fillStyle = getComputedStyle(document.body).getPropertyValue("--card").trim() || "#fff"; g.globalAlpha = 0.85; g.fillRect(bx, by, w, h); g.globalAlpha = 1;
        lab.forEach((s, i) => { drawKey(g, s, bx + 6, by + 12 + i * 16); g.fillStyle = ink; g.fillText(s.label, bx + 28, by + 12 + i * 16); }); }
    }
    return { X, Y, L, T, pw, ph };
  };
  function drawKey(g, s, x, y) {
    const c = s.color || "#888"; g.strokeStyle = c; g.fillStyle = c; g.setLineDash(s.dash || []);
    if (s.type === "points") { g.beginPath(); g.arc(x + 9, y, 3, 0, 7); s.hollow ? g.stroke() : g.fill(); }
    else if (s.type === "bar" || s.type === "band") { g.globalAlpha = s.type === "band" ? 0.3 : 1; g.fillRect(x + 2, y - 5, 14, 10); g.globalAlpha = 1; }
    else { g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y); g.stroke(); }
    g.setLineDash([]);
  }
  // redraw all charts on resize
  const registry = []; AD.chart = (fn) => { registry.push(fn); fn(); };
  let rt = null; G.addEventListener && G.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => registry.forEach((f) => f()), 150); });
})(typeof window !== "undefined" ? window : globalThis);
