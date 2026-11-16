/* Machine learning methods used in the companion apps, written out in plain JavaScript.
   Isolation Forest, Local Outlier Factor, One-Class SVM, Mahalanobis distance, decision trees,
   random forest classifier, gradient boosting regressor and a small dense autoencoder.
   These are teaching implementations: correct in principle, kept short, not tuned for speed.
   Copyright (c) 2026 Yam Khoon Tor. All rights reserved. */
(function (G) {
  "use strict";
  const AD = G.AD || (G.AD = {});
  const ML = AD.ml = {};
  const S = AD.stats, Lin = AD.lin;

  // ------------------------------------------------------------- scaling with training statistics only
  ML.scaler = (Xtr) => { const p = Xtr[0].length; const mu = [], sd = [];
    for (let j = 0; j < p; j++) { const c = Xtr.map((r) => r[j]); mu.push(S.mean(c)); sd.push(S.sd(c) || 1); }
    return { mu, sd, t: (X) => X.map((r) => r.map((v, j) => (v - mu[j]) / sd[j])) }; };

  // ------------------------------------------------------------- Mahalanobis distance
  ML.mahalanobis = (Xtr) => { const { mu, C } = Lin.cov(Xtr); const Ci = Lin.inv(C);
    return (x) => { const d = x.map((v, j) => v - mu[j]); let s = 0; for (let a = 0; a < d.length; a++) for (let b = 0; b < d.length; b++) s += d[a] * Ci[a][b] * d[b]; return s; }; };

  // ------------------------------------------------------------- Isolation Forest (Liu et al., 2008)
  const cFactor = (n) => n <= 1 ? 0 : 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
  ML.isolationForest = (Xtr, { trees = 100, sample = 256, seed = 1 } = {}) => {
    const R = AD.rng(seed), psi = Math.min(sample, Xtr.length), hmax = Math.ceil(Math.log2(psi)), p = Xtr[0].length;
    const build = (rows, depth) => {
      if (depth >= hmax || rows.length <= 1) return { size: rows.length };
      const f = R.int(p); let lo = Infinity, hi = -Infinity; for (const r of rows) { lo = Math.min(lo, r[f]); hi = Math.max(hi, r[f]); }
      if (lo === hi) return { size: rows.length };
      const s = R.uniform(lo, hi), L = [], Rr = []; for (const r of rows) (r[f] < s ? L : Rr).push(r);
      return { f, s, l: build(L, depth + 1), r: build(Rr, depth + 1) };
    };
    const forest = []; for (let t = 0; t < trees; t++) { const idx = R.shuffle(S.range(Xtr.length)).slice(0, psi); forest.push(build(idx.map((i) => Xtr[i]), 0)); }
    const path = (node, x, d) => node.size !== undefined ? d + cFactor(node.size) : path(x[node.f] < node.s ? node.l : node.r, x, d + 1);
    const c = cFactor(psi);
    return (x) => Math.pow(2, -S.mean(forest.map((tr) => path(tr, x, 0))) / c);
  };

  // ------------------------------------------------------------- Local Outlier Factor, novelty mode (Breunig et al., 2000)
  const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };
  ML.lof = (Xtr, k = 20) => {
    const n = Xtr.length, knn = [], kd = new Array(n);
    for (let i = 0; i < n; i++) { const ds = []; for (let j = 0; j < n; j++) if (j !== i) ds.push([dist(Xtr[i], Xtr[j]), j]); ds.sort((a, b) => a[0] - b[0]); knn.push(ds.slice(0, k)); kd[i] = ds[k - 1][0]; }
    const lrd = knn.map((nb) => 1 / (S.mean(nb.map(([d, j]) => Math.max(d, kd[j]))) + 1e-12));
    return (x) => { const ds = Xtr.map((r, j) => [dist(x, r), j]).sort((a, b) => a[0] - b[0]).slice(0, k);
      const lx = 1 / (S.mean(ds.map(([d, j]) => Math.max(d, kd[j]))) + 1e-12); return S.mean(ds.map(([, j]) => lrd[j])) / lx; };
  };

  // ------------------------------------------------------------- One-Class SVM with RBF kernel (Schölkopf et al., 2001)
  // Dual: minimise 1/2 a'Ka subject to 0 <= a_i <= 1/(nu n), sum a = 1. Solved by projected gradient onto the capped simplex.
  ML.oneClassSVM = (Xtr, { nu = 0.05, gamma = null, iters = 400 } = {}) => {
    const n = Xtr.length, p = Xtr[0].length, gm = gamma || 1 / p, cap = 1 / (nu * n);
    const K = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Math.exp(-gm * dist(Xtr[i], Xtr[j]) ** 2)));
    let a = new Array(n).fill(1 / n);
    const project = (v) => { // projection onto {0<=a<=cap, sum=1} by bisection on the shift
      let lo = Math.min(...v) - cap, hi = Math.max(...v); for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; const s = v.reduce((t, x) => t + Math.min(cap, Math.max(0, x - m)), 0); if (s > 1) lo = m; else hi = m; }
      const m = (lo + hi) / 2; return v.map((x) => Math.min(cap, Math.max(0, x - m))); };
    const Kv = (v) => K.map((r) => { let s = 0; for (let j = 0; j < n; j++) s += r[j] * v[j]; return s; });
    // step 1/L, L = largest eigenvalue of K (power iteration); accelerated projected gradient (FISTA)
    let e = new Array(n).fill(1 / Math.sqrt(n)), lam = 1;
    for (let it = 0; it < 30; it++) { const w = Kv(e); lam = Math.sqrt(w.reduce((s, x) => s + x * x, 0)); e = w.map((x) => x / lam); }
    const step = 1 / lam; let yk = a.slice(), tk = 1;
    for (let it = 0; it < iters; it++) { const g = Kv(yk); const an = project(yk.map((v, i) => v - step * g[i]));
      const tn = (1 + Math.sqrt(1 + 4 * tk * tk)) / 2; yk = an.map((v, i) => v + ((tk - 1) / tn) * (v - a[i])); a = an; tk = tn; }
    const f = (x) => Xtr.reduce((s, r, j) => s + (a[j] > 1e-9 ? a[j] * Math.exp(-gm * dist(x, r) ** 2) : 0), 0);
    const margin = S.range(n).filter((i) => a[i] > 1e-6 && a[i] < cap - 1e-6);
    const rho = margin.length ? S.mean(margin.map((i) => f(Xtr[i]))) : S.quantile(Xtr.map(f), nu);
    return (x) => rho - f(x);   // larger = more unusual
  };

  // ------------------------------------------------------------- decision trees (pre-binned features for speed)
  // Each feature is cut at up to nBins-1 quantile thresholds computed once; a node is split by scanning bin totals.
  function binner(X, nBins = 24) {
    const p = X[0].length, cuts = [];
    for (let f = 0; f < p; f++) { const col = X.map((r) => r[f]); const c = new Set(); for (let q = 1; q < nBins; q++) c.add(S.quantile(col, q / nBins)); cuts.push([...c].sort((a, b) => a - b)); }
    const bin = (x, f) => { const c = cuts[f]; let lo = 0, hi = c.length; while (lo < hi) { const m = (lo + hi) >> 1; if (x[f] <= c[m]) hi = m; else lo = m + 1; } return lo; };
    const B = X.map((x) => cuts.map((_, f) => bin(x, f)));
    return { cuts, B };
  }
  function growTree(B, cuts, y, idx, opts, depth = 0) {
    const { task, nClass, maxDepth, minLeaf, R, mtry } = opts;
    const leaf = () => { if (task === "reg") { let s = 0; for (const i of idx) s += y[i]; return { v: s / idx.length }; }
      const cnt = new Array(nClass).fill(0); idx.forEach((i) => cnt[y[i]]++); return { p: cnt.map((c) => c / idx.length) }; };
    if (depth >= maxDepth || idx.length < 2 * minLeaf) return leaf();
    const p = cuts.length, feats = mtry ? R.shuffle(S.range(p)).slice(0, mtry) : S.range(p);
    let best = null;
    for (const f of feats) {
      const nb = cuts[f].length + 1;
      if (task === "reg") {
        const cnt = new Float64Array(nb), sm = new Float64Array(nb), sq = new Float64Array(nb);
        for (const i of idx) { const k = B[i][f]; cnt[k]++; sm[k] += y[i]; sq[k] += y[i] * y[i]; }
        let tc = 0, ts = 0, tq = 0; for (let k = 0; k < nb; k++) { tc += cnt[k]; ts += sm[k]; tq += sq[k]; }
        let lc = 0, ls = 0, lq = 0;
        for (let k = 0; k < nb - 1; k++) { lc += cnt[k]; ls += sm[k]; lq += sq[k]; const rc = tc - lc;
          if (lc < minLeaf || rc < minLeaf) continue;
          const sc = (lq - ls * ls / lc) + ((tq - lq) - (ts - ls) ** 2 / rc);
          if (!best || sc < best.sc) best = { f, k, sc }; }
      } else {
        const cnt = Array.from({ length: nb }, () => new Float64Array(nClass));
        for (const i of idx) cnt[B[i][f]][y[i]]++;
        const tot = new Float64Array(nClass); for (let k = 0; k < nb; k++) for (let c = 0; c < nClass; c++) tot[c] += cnt[k][c];
        const left = new Float64Array(nClass); let ln = 0;
        for (let k = 0; k < nb - 1; k++) { for (let c = 0; c < nClass; c++) { left[c] += cnt[k][c]; ln += cnt[k][c]; }
          const rn = idx.length - ln; if (ln < minLeaf || rn < minLeaf) continue;
          let gl = 0, gr = 0; for (let c = 0; c < nClass; c++) { gl += (left[c] / ln) ** 2; gr += ((tot[c] - left[c]) / rn) ** 2; }
          const sc = ln * (1 - gl) + rn * (1 - gr); if (!best || sc < best.sc) best = { f, k, sc }; }
      }
    }
    if (!best) return leaf();
    const L = [], Rr = []; for (const i of idx) (B[i][best.f] <= best.k ? L : Rr).push(i);
    return { f: best.f, c: cuts[best.f][best.k], l: growTree(B, cuts, y, L, opts, depth + 1), r: growTree(B, cuts, y, Rr, opts, depth + 1) };
  }
  const predictTree = (t, x) => (t.f === undefined ? t : predictTree(x[t.f] <= t.c ? t.l : t.r, x));

  ML.randomForest = (X, y, { classes, trees = 60, maxDepth = 6, minLeaf = 2, seed = 7 } = {}) => {
    const R = AD.rng(seed), nClass = classes.length, mtry = Math.max(1, Math.round(Math.sqrt(X[0].length))), forest = [];
    const { cuts, B } = binner(X);
    for (let t = 0; t < trees; t++) { const idx = S.range(X.length).map(() => R.int(X.length));
      forest.push(growTree(B, cuts, y, idx, { task: "cls", nClass, maxDepth, minLeaf, R, mtry })); }
    return { predictProba: (x) => { const p = new Array(nClass).fill(0); forest.forEach((t) => predictTree(t, x).p.forEach((v, i) => (p[i] += v / trees))); return p; }, classes };
  };

  ML.gradientBoosting = (X, y, { rounds = 150, rate = 0.08, maxDepth = 3, minLeaf = 8, seed = 3 } = {}) => {
    const R = AD.rng(seed), base = S.mean(y), trees = []; let f = y.map(() => base);
    const { cuts, B } = binner(X), all = S.range(X.length);
    for (let m = 0; m < rounds; m++) { const r = y.map((v, i) => v - f[i]);
      const t = growTree(B, cuts, r, all, { task: "reg", maxDepth, minLeaf, R }); trees.push(t);
      f = f.map((v, i) => v + rate * predictTree(t, X[i]).v); }
    return { predict: (x) => trees.reduce((s, t) => s + rate * predictTree(t, x).v, base) };
  };

  // ------------------------------------------------------------- dense autoencoder (tanh hidden layers, linear output), Adam
  ML.autoencoder = (Xtr, { hidden = [16, 6, 16], epochs = 40, lr = 0.01, batch = 32, seed = 5, outDims = null } = {}) => {
    const R = AD.rng(seed), nin = Xtr[0].length, nout = outDims || nin, sizes = [nin, ...hidden, nout];
    const W = [], b = [], mW = [], vW = [], mb = [], vb = [];
    for (let l = 0; l < sizes.length - 1; l++) { const s = Math.sqrt(2 / (sizes[l] + sizes[l + 1]));
      W.push(Array.from({ length: sizes[l + 1] }, () => Array.from({ length: sizes[l] }, () => R.normal(0, s))));
      b.push(new Array(sizes[l + 1]).fill(0)); mW.push(W[l].map((r) => r.map(() => 0))); vW.push(W[l].map((r) => r.map(() => 0)));
      mb.push(b[l].map(() => 0)); vb.push(b[l].map(() => 0)); }
    const last = W.length - 1;
    const forward = (x) => { const acts = [x]; let h = x;
      for (let l = 0; l < W.length; l++) { const z = W[l].map((row, i) => row.reduce((s, w, j) => s + w * h[j], b[l][i])); h = l === last ? z : z.map(Math.tanh); acts.push(h); }
      return acts; };
    let t = 0; const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    for (let ep = 0; ep < epochs; ep++) {
      const order = R.shuffle(S.range(Xtr.length));
      for (let s = 0; s < order.length; s += batch) {
        const ids = order.slice(s, s + batch); const gW = W.map((m) => m.map((r) => r.map(() => 0))), gb = b.map((v) => v.map(() => 0));
        for (const i of ids) { const acts = forward(Xtr[i]); const target = Xtr[i].slice(0, nout);
          let delta = acts[acts.length - 1].map((o, k) => 2 * (o - target[k]) / nout);
          for (let l = last; l >= 0; l--) { const a = acts[l];
            for (let r = 0; r < W[l].length; r++) { gb[l][r] += delta[r]; for (let c = 0; c < a.length; c++) gW[l][r][c] += delta[r] * a[c]; }
            if (l > 0) { const prev = new Array(a.length).fill(0); for (let r = 0; r < W[l].length; r++) for (let c = 0; c < a.length; c++) prev[c] += W[l][r][c] * delta[r];
              delta = prev.map((d, c) => d * (1 - a[c] * a[c])); } } }
        t++; const n = ids.length;
        for (let l = 0; l < W.length; l++) { for (let r = 0; r < W[l].length; r++) {
          for (let c = 0; c < W[l][r].length; c++) { const g = gW[l][r][c] / n; mW[l][r][c] = b1 * mW[l][r][c] + (1 - b1) * g; vW[l][r][c] = b2 * vW[l][r][c] + (1 - b2) * g * g;
            W[l][r][c] -= lr * (mW[l][r][c] / (1 - b1 ** t)) / (Math.sqrt(vW[l][r][c] / (1 - b2 ** t)) + eps); }
          const g = gb[l][r] / n; mb[l][r] = b1 * mb[l][r] + (1 - b1) * g; vb[l][r] = b2 * vb[l][r] + (1 - b2) * g * g;
          b[l][r] -= lr * (mb[l][r] / (1 - b1 ** t)) / (Math.sqrt(vb[l][r] / (1 - b2 ** t)) + eps); } }
      }
    }
    return (x) => { const o = forward(x)[sizes.length - 1]; let s = 0; for (let k = 0; k < nout; k++) s += (o[k] - x[k]) ** 2; return s / nout; };
  };

  // ------------------------------------------------------------- control charts and filters shared by several apps
  ML.cusumLower = (x, mu, sd, k = 0.5, h = 5) => { let s = 0, hit = -1; const out = x.map((v, i) => { s = Math.max(0, s + (mu - v) / sd - k); if (s > h && hit < 0) hit = i; return s; }); return { s: out, hit }; };
  ML.cusumTwo = (z, k = 0.5, h = 5) => { let sp = 0, sn = 0; return z.map((v) => { sp = Math.max(0, sp + v - k); sn = Math.max(0, sn - v - k); if (sp > h || sn > h) { sp = sn = 0; return true; } return false; }); };
  ML.ewma = (x, mu, lam = 0.1) => { let z = mu; return x.map((v) => (z = lam * v + (1 - lam) * z)); };
  // Kalman filter, constant velocity (state d, v), step dt; returns states and innovations
  ML.kalmanCV = (z, { dt = 1, sigma = 1, q = 1e-4 } = {}) => {
    let x = [z[0], 0], P = [[sigma * sigma, 0], [0, 1]]; const out = [];
    for (let k = 0; k < z.length; k++) {
      if (k > 0) { x = [x[0] + dt * x[1], x[1]];
        const Q = [[q * dt ** 3 / 3, q * dt ** 2 / 2], [q * dt ** 2 / 2, q * dt]];
        P = [[P[0][0] + dt * (P[1][0] + P[0][1]) + dt * dt * P[1][1] + Q[0][0], P[0][1] + dt * P[1][1] + Q[0][1]], [P[1][0] + dt * P[1][1] + Q[1][0], P[1][1] + Q[1][1]]]; }
      if (!Number.isFinite(z[k])) { out.push({ d: x[0], v: x[1], P: P.map((r) => r.slice()), r: NaN, T: NaN }); continue; }
      const r = z[k] - x[0], Sv = P[0][0] + sigma * sigma, K = [P[0][0] / Sv, P[1][0] / Sv];
      x = [x[0] + K[0] * r, x[1] + K[1] * r];
      P = [[(1 - K[0]) * P[0][0], (1 - K[0]) * P[0][1]], [P[1][0] - K[1] * P[0][0], P[1][1] - K[1] * P[0][1]]];
      out.push({ d: x[0], v: x[1], P: P.map((r) => r.slice()), r, T: r * r / Sv });
    }
    return out;
  };
  // forecast h steps ahead from a constant-velocity state
  ML.kalmanAhead = (st, h, { q = 1e-4, sigma = 1 } = {}) => { let P = st.P.map((r) => r.slice());
    for (let k = 0; k < h; k++) { const Q = [[q / 3, q / 2], [q / 2, q]]; P = [[P[0][0] + P[1][0] + P[0][1] + P[1][1] + Q[0][0], P[0][1] + P[1][1] + Q[0][1]], [P[1][0] + P[1][1] + Q[1][0], P[1][1] + Q[1][1]]]; }
    return { m: st.d + h * st.v, s: Math.sqrt(P[0][0] + sigma * sigma) }; };
})(typeof window !== "undefined" ? window : globalThis);
