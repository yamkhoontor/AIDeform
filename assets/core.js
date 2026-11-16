/* AI for Deformation Monitoring — companion apps
   Core helpers: seeded random numbers, statistics, distributions, small linear algebra, page controls.
   Copyright (c) 2026 Yam Khoon Tor. All rights reserved. For readers' personal study. */
(function (G) {
  "use strict";
  const AD = G.AD || (G.AD = {});

  // ------------------------------------------------------------------ random numbers (repeatable)
  AD.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    const u = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let spare = null;
    const normal = (m = 0, s = 1) => {
      if (spare !== null) { const v = spare; spare = null; return m + s * v; }
      let x, y, r; do { x = 2 * u() - 1; y = 2 * u() - 1; r = x * x + y * y; } while (r >= 1 || r === 0);
      const f = Math.sqrt(-2 * Math.log(r) / r); spare = y * f; return m + s * x * f;
    };
    return { u, normal, int: (n) => Math.floor(u() * n), pick: (arr) => arr[Math.floor(u() * arr.length)],
      uniform: (a, b) => a + (b - a) * u(),
      shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; } };
  };

  // ------------------------------------------------------------------ statistics
  const S = AD.stats = {};
  S.sum = (a) => a.reduce((s, v) => s + v, 0);
  S.mean = (a) => S.sum(a) / a.length;
  S.sd = (a) => { const m = S.mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); };
  S.quantile = (a, q) => { const b = a.filter(Number.isFinite).slice().sort((x, y) => x - y); if (!b.length) return NaN;
    const p = (b.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return b[lo] + (b[hi] - b[lo]) * (p - lo); };
  S.median = (a) => S.quantile(a, 0.5);
  S.mad = (a) => { const m = S.median(a); return S.median(a.map((v) => Math.abs(v - m))); };
  S.modz = (a) => { const m = S.median(a), d = S.mad(a) || 1e-9; return a.map((v) => 0.6745 * (v - m) / d); };
  S.range = (n, start = 0, step = 1) => Array.from({ length: n }, (_, i) => start + i * step);
  S.rmse = (a, b) => Math.sqrt(S.mean(a.map((v, i) => (v - b[i]) ** 2)));
  S.corr = (a, b) => { const ma = S.mean(a), mb = S.mean(b); let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
    return sab / Math.sqrt(saa * sbb); };
  S.rolling = (a, w, f, center = false) => a.map((_, i) => { const lo = center ? i - Math.floor(w / 2) : i - w + 1, hi = center ? lo + w : i + 1;
    const seg = a.slice(Math.max(0, lo), Math.min(a.length, hi)).filter(Number.isFinite); return seg.length >= Math.max(2, w / 3) ? f(seg) : NaN; });

  // ------------------------------------------------------------------ linear algebra (small dense)
  const L = AD.lin = {};
  L.zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
  L.T = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  L.mul = (A, B) => { const n = A.length, m = B[0].length, k = B.length, C = L.zeros(n, m);
    for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) { const a = A[i][p]; if (a) for (let j = 0; j < m; j++) C[i][j] += a * B[p][j]; } return C; };
  L.mv = (A, x) => A.map((r) => r.reduce((s, v, j) => s + v * x[j], 0));
  L.inv = (A) => { const n = A.length, M = A.map((r, i) => [...r, ...S.range(n).map((j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; if (Math.abs(d) < 1e-14) throw new Error("singular matrix");
      for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; } }
    return M.map((r) => r.slice(n)); };
  // weighted least squares: returns {x, Qxx, v, s0, dof}
  L.lsq = (A, y, w) => { const n = A.length, m = A[0].length; const W = w || new Array(n).fill(1);
    const N = L.zeros(m, m), u = new Array(m).fill(0);
    for (let i = 0; i < n; i++) for (let a = 0; a < m; a++) { u[a] += A[i][a] * W[i] * y[i]; for (let b = 0; b < m; b++) N[a][b] += A[i][a] * W[i] * A[i][b]; }
    const Q = L.inv(N), x = L.mv(Q, u), v = A.map((r, i) => r.reduce((s, c, j) => s + c * x[j], 0) - y[i]);
    const dof = n - m, s0sq = v.reduce((s, vi, i) => s + W[i] * vi * vi, 0) / Math.max(dof, 1);
    return { x, Qxx: Q, v, s0: Math.sqrt(s0sq), dof, cov: Q.map((r) => r.map((q) => q * s0sq)) }; };
  L.polyfit = (t, y, deg = 1) => L.lsq(t.map((ti) => S.range(deg + 1).map((p) => ti ** p)), y);
  L.cov = (X) => { const n = X.length, p = X[0].length, mu = S.range(p).map((j) => S.mean(X.map((r) => r[j])));
    const C = L.zeros(p, p); for (const r of X) for (let a = 0; a < p; a++) { const da = r[a] - mu[a]; for (let b = a; b < p; b++) C[a][b] += da * (r[b] - mu[b]); }
    for (let a = 0; a < p; a++) for (let b = a; b < p; b++) { C[a][b] /= n - 1; C[b][a] = C[a][b]; } return { mu, C }; };

  // ------------------------------------------------------------------ distributions
  const D = AD.dist = {};
  D.normCdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989422804014327 * Math.exp(-x * x / 2);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return x > 0 ? 1 - p : p; };
  D.normPdf = (x, m = 0, s = 1) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  D.normPpf = (p) => { // Acklam
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); };
  D.gammaln = (x) => { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); };
  D.gammaP = (a, x) => { if (x <= 0) return 0;
    if (x < a + 1) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; }
      return sum * Math.exp(-x + a * Math.log(x) - D.gammaln(a)); }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
    return 1 - Math.exp(-x + a * Math.log(x) - D.gammaln(a)) * h; };
  D.chi2Cdf = (x, k) => D.gammaP(k / 2, x / 2);
  const betacf = (a, b, x) => { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
    return h; };
  D.ibeta = (x, a, b) => { if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(D.gammaln(a + b) - D.gammaln(a) - D.gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; };
  D.tCdf = (t, v) => { const x = v / (v + t * t), p = 0.5 * D.ibeta(x, v / 2, 0.5); return t > 0 ? 1 - p : p; };
  D.fCdf = (f, d1, d2) => f <= 0 ? 0 : D.ibeta(d1 * f / (d1 * f + d2), d1 / 2, d2 / 2);
  const invert = (cdf, p, lo, hi) => { for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (cdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
  D.chi2Ppf = (p, k) => invert((x) => D.chi2Cdf(x, k), p, 0, 1000);
  D.tPpf = (p, v) => invert((x) => D.tCdf(x, v), p, -100, 100);
  D.fPpf = (p, d1, d2) => invert((x) => D.fCdf(x, d1, d2), p, 0, 1000);

  // ------------------------------------------------------------------ formatting
  AD.fmt = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v)) ? "–" : v.toFixed(d);

  // ------------------------------------------------------------------ page controls
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== undefined) e.setAttribute(k, v); }
    for (const k of kids.flat()) e.append(k instanceof Node ? k : document.createTextNode(String(k))); return e; };
  AD.el = el;
  AD.controls = function (host, specs, onChange) {
    const state = {}; const box = typeof host === "string" ? document.querySelector(host) : host;
    let timer = null; const fire = () => { clearTimeout(timer); timer = setTimeout(() => onChange(state), 60); };
    for (const s of specs) {
      const id = "c_" + s.key;
      if (s.type === "select") {
        state[s.key] = s.value;
        const sel = el("select", { id, onchange: (e) => { state[s.key] = e.target.value; fire(); } },
          s.options.map((o) => { const op = el("option", { value: o.value }, o.label); if (o.value === s.value) op.selected = true; return op; }));
        box.append(el("div", { class: "ctl" }, el("label", { for: id }, s.label), sel));
      } else if (s.type === "check") {
        state[s.key] = !!s.value;
        const cb = el("input", { type: "checkbox", id, onchange: (e) => { state[s.key] = e.target.checked; fire(); } }); cb.checked = !!s.value;
        box.append(el("div", { class: "ctl check" }, cb, el("label", { for: id }, s.label)));
      } else if (s.type === "button") {
        box.append(el("div", { class: "ctl" }, el("button", { type: "button", id: "c_" + s.key, onclick: () => s.onClick(state) }, s.label)));
      } else {
        state[s.key] = s.value;
        const out = el("output", { for: id }, fmtVal(s.value, s));
        const inp = el("input", { type: "range", id, min: s.min, max: s.max, step: s.step, value: s.value,
          oninput: (e) => { state[s.key] = parseFloat(e.target.value); out.textContent = fmtVal(state[s.key], s); fire(); } });
        box.append(el("div", { class: "ctl" }, el("label", { for: id }, s.label, " ", out), inp));
      }
    }
    return state;
  };
  function fmtVal(v, s) { const d = s.decimals !== undefined ? s.decimals : (String(s.step).split(".")[1] || "").length; return v.toFixed(d) + (s.unit ? " " + s.unit : ""); }

  AD.table = function (host, header, rows, opts = {}) {
    const box = typeof host === "string" ? document.querySelector(host) : host; box.innerHTML = "";
    const t = el("table", { class: "data" + (opts.compact ? " compact" : "") }, el("thead", {}, el("tr", {}, header.map((h) => el("th", {}, h)))),
      el("tbody", {}, rows.map((r, i) => el("tr", { class: opts.highlight && opts.highlight(i, r) ? "hl" : "" }, r.map((c) => el("td", {}, c === null || c === undefined ? "–" : c))))));
    box.append(t); return t;
  };
  AD.badge = (level) => el("span", { class: "badge " + ({ "Established": "est", "Early adoption": "early", "Experimental": "exp" }[level] || "") }, level);
  AD.ready = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn());
})(typeof window !== "undefined" ? window : globalThis);
