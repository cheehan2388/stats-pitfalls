/* lab.js — 互動實驗共用函式庫（時間序列白話 Wiki）
 *
 * 新增函式時請同步更新這段註解（見 AGENTS.md 第 10 節）。
 *
 * 註冊
 *   Lab.register(slug, function (lab) { ... })
 *
 * 亂數（固定種子）
 *   const rng = Lab.random(seed)
 *   rng.uniform()            0–1 均勻分布
 *   rng.normal()             標準常態
 *   rng.studentT(df)         自由度 df 的 t 分布（df 越小尾巴越厚），已縮放為單位變異數（df > 2）
 *
 * 統計
 *   Lab.mean(a) Lab.std(a) Lab.median(a) Lab.mad(a) Lab.quantile(a, q)
 *   Lab.rollingMean(a, n) Lab.rollingStd(a, n) Lab.rollingMedian(a, n)   前 n−1 個為 null
 *   Lab.rolling(a, n, fn)    任意滾動統計，fn 接收長度 n 的視窗陣列
 *   Lab.acf(a, maxLag)       自相關係數陣列，索引 0 對應 lag 0（恆為 1）
 *   Lab.pearson(x, y) Lab.spearman(x, y) Lab.cumsum(a)
 *   Lab.normalCdf(z)         標準常態累積機率
 *   Lab.fmt(v, digits)       數字格式化
 *
 * 控制項（回傳「取得目前值」的函式）
 *   lab.slider({ id, label, min, max, step, value, format })
 *   lab.select({ id, label, options: [{ value, label }], value })
 *   lab.onChange(fn)         立刻執行一次，之後每次控制項變動時執行
 *
 * 輸出
 *   lab.stats([{ label, value, tone, note }])     tone: 'data' | 'model' | 'alt' | undefined
 *   lab.caption(text)
 *   lab.chart({ slot, title, height, xLabel, yLabel, yMin, yMax, series: [...] })
 *     series 類型（role: 'data' | 'model' | 'alt' | 'muted'）
 *       { type: 'line', role, y: [...], label, dashed }            x 為索引
 *       { type: 'bars', role, y: [...], label }                    x 為索引的直條（例如自相關圖）
 *       { type: 'band', role, lo: [...], hi: [...], label }        x 為索引
 *       { type: 'dots', role, points: [[x, y], ...], label, hollow, r }
 *       { type: 'hline', role, y, label }
 *       { type: 'path', role, points: [[x, y], ...], label, dashed }   依座標連線（例如迴歸線）
 *     slot 相同的呼叫會更新同一張圖；不同 slot 會依序往下排。
 */
(function () {
  'use strict';
  var registry = {};
  var NS = 'http://www.w3.org/2000/svg';
  var ROLE = { data: 'var(--viz-data)', model: 'var(--viz-model)', alt: 'var(--viz-alt)', muted: 'var(--viz-muted)' };

  function el(tag, attrs, parent, text) {
    var svgTags = { svg: 1, path: 1, line: 1, circle: 1, rect: 1, text: 1, g: 1 };
    var node = svgTags[tag] ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (var k in attrs || {}) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  // ---------- 亂數 ----------
  function random(seed) {
    var s = seed >>> 0;
    function uniform() { // mulberry32
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function normal() {
      var u = 0, v = 0;
      while (u === 0) u = uniform();
      v = uniform();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    function studentT(df) {
      var z = normal(), chi = 0;
      for (var i = 0; i < df; i++) { var n = normal(); chi += n * n; }
      var t = z / Math.sqrt(chi / df);
      return df > 2 ? t / Math.sqrt(df / (df - 2)) : t;
    }
    return { uniform: uniform, normal: normal, studentT: studentT };
  }

  // ---------- 統計 ----------
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function std(a) {
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }
  function quantile(a, q) {
    var b = a.slice().sort(function (x, y) { return x - y; });
    var pos = (b.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return b[lo] + (b[hi] - b[lo]) * (pos - lo);
  }
  function median(a) { return quantile(a, 0.5); }
  function mad(a) { var m = median(a); return median(a.map(function (v) { return Math.abs(v - m); })); }
  function rolling(a, n, fn) {
    return a.map(function (_, i) { return i < n - 1 ? null : fn(a.slice(i - n + 1, i + 1)); });
  }
  function rollingMean(a, n) { return rolling(a, n, mean); }
  function rollingStd(a, n) { return rolling(a, n, std); }
  function rollingMedian(a, n) { return rolling(a, n, median); }
  function pearson(x, y) {
    var mx = mean(x), my = mean(y), sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < x.length; i++) {
      sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my);
    }
    return sxy / Math.sqrt(sxx * syy);
  }
  function rank(a) {
    var idx = a.map(function (v, i) { return [v, i]; }).sort(function (p, q) { return p[0] - q[0]; });
    var r = new Array(a.length), i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (var k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  }
  function spearman(x, y) { return pearson(rank(x), rank(y)); }
  function normalCdf(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }
  function acf(a, maxLag) {
    var m = mean(a), den = 0, out = [];
    for (var i = 0; i < a.length; i++) den += (a[i] - m) * (a[i] - m);
    for (var k = 0; k <= maxLag; k++) {
      var num = 0;
      for (var j = k; j < a.length; j++) num += (a[j] - m) * (a[j - k] - m);
      out.push(num / den);
    }
    return out;
  }
  function cumsum(a) { var s = 0; return a.map(function (v) { s += v; return s; }); }
  function fmt(v, d) {
    if (v == null || isNaN(v)) return '—';
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  }

  // ---------- 圖表 ----------
  function niceTicks(lo, hi, n) {
    var span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n)));
    var err = span / n / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var t = [], v = Math.ceil(lo / step) * step;
    for (; v <= hi + step * 1e-9; v += step) t.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { ticks: t, digits: Math.max(0, -Math.floor(Math.log10(step))) };
  }

  function drawChart(host, cfg) {
    host.innerHTML = '';
    if (cfg.title) el('p', { class: 'lab-chart-title' }, host, cfg.title);

    var legendItems = cfg.series.filter(function (s) { return s.label; });
    if (legendItems.length > 1) {
      var lg = el('ul', { class: 'lab-legend' }, host);
      legendItems.forEach(function (s) {
        var li = el('li', {}, lg);
        var sw = el('span', { class: 'sw sw-' + (s.type === 'path' ? 'line' : s.type) + (s.hollow ? ' sw-hollow' : '') + (s.dashed ? ' sw-dashed' : '') }, li);
        sw.style.setProperty('--c', ROLE[s.role] || ROLE.muted);
        el('span', {}, li, s.label);
      });
    }

    var W = 720, H = cfg.height || 300, m = { l: 52, r: 16, t: 12, b: cfg.xLabel ? 44 : 28 };
    var wrap = el('div', { class: 'lab-plot' }, host);
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': cfg.title || '互動圖表' }, wrap);

    var xs = [], ys = [];
    cfg.series.forEach(function (s) {
      if (s.type === 'bars') { s.y.forEach(function (v, i) { xs.push(i); ys.push(v); }); ys.push(0); xs.push(-0.6, s.y.length - 0.4); }
      if (s.type === 'line') s.y.forEach(function (v, i) { if (v != null) { xs.push(i); ys.push(v); } });
      if (s.type === 'band') s.lo.forEach(function (v, i) { if (v != null) { xs.push(i); ys.push(v, s.hi[i]); } });
      if (s.type === 'dots' || s.type === 'path') s.points.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
      if (s.type === 'hline') ys.push(s.y);
    });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = cfg.yMin != null ? cfg.yMin : Math.min.apply(null, ys), y1 = cfg.yMax != null ? cfg.yMax : Math.max.apply(null, ys);
    var padY = (y1 - y0) * 0.06 || 1, padX = cfg.padX ? (x1 - x0) * 0.04 : 0;
    if (cfg.yMin == null) y0 -= padY;
    if (cfg.yMax == null) y1 += padY;
    x0 -= padX; x1 += padX;
    function X(v) { return m.l + (v - x0) / (x1 - x0 || 1) * (W - m.l - m.r); }
    function Y(v) { return H - m.b - (v - y0) / (y1 - y0 || 1) * (H - m.t - m.b); }

    var yt = niceTicks(y0, y1, 5);
    yt.ticks.forEach(function (t) {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'grid zero' : 'grid' }, svg);
      el('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick' }, svg, fmt(t, yt.digits));
    });
    var xt = niceTicks(x0, x1, 6);
    xt.ticks.forEach(function (t) {
      el('text', { x: X(t), y: H - m.b + 16, 'text-anchor': 'middle', class: 'tick' }, svg, fmt(t, xt.digits));
    });
    if (cfg.xLabel) el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-label' }, svg, cfg.xLabel);
    if (cfg.yLabel) el('text', { x: 12, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'axis-label', transform: 'rotate(-90 12 ' + (m.t + H - m.b) / 2 + ')' }, svg, cfg.yLabel);

    function linePath(arr) {
      var d = '', pen = false;
      arr.forEach(function (v, i) {
        if (v == null) { pen = false; return; }
        d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
        pen = true;
      });
      return d;
    }
    var order = { band: 0, bars: 0, hline: 1, line: 2, dots: 3, path: 4 };
    cfg.series.slice().sort(function (a, b) { return order[a.type] - order[b.type]; }).forEach(function (s) {
      var c = ROLE[s.role] || ROLE.muted;
      if (s.type === 'band') {
        var up = '', dn = '', started = false;
        s.hi.forEach(function (v, i) { if (v == null) return; up += (started ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); started = true; });
        for (var i = s.lo.length - 1; i >= 0; i--) if (s.lo[i] != null) dn += 'L' + X(i).toFixed(1) + ' ' + Y(s.lo[i]).toFixed(1);
        el('path', { d: up + dn + 'Z', class: 'band' }, svg).style.fill = c;
        el('path', { d: linePath(s.hi), class: 'band-edge' }, svg).style.stroke = c;
        el('path', { d: linePath(s.lo), class: 'band-edge' }, svg).style.stroke = c;
      } else if (s.type === 'bars') {
        var bw = Math.max(2, Math.min(18, (X(1) - X(0)) * 0.6));
        s.y.forEach(function (v, i) {
          var top = Math.min(Y(v), Y(0)), hgt = Math.max(1, Math.abs(Y(v) - Y(0)));
          el('rect', { x: X(i) - bw / 2, y: top, width: bw, height: hgt, rx: Math.min(2, bw / 2), class: 'bar' }, svg).style.fill = c;
        });
      } else if (s.type === 'hline') {
        el('line', { x1: m.l, x2: W - m.r, y1: Y(s.y), y2: Y(s.y), class: 'hline' }, svg).style.stroke = c;
      } else if (s.type === 'line') {
        el('path', { d: linePath(s.y), class: 'series-line' + (s.dashed ? ' dashed' : '') }, svg).style.stroke = c;
      } else if (s.type === 'path') {
        var pd = s.points.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('');
        el('path', { d: pd, class: 'series-line' + (s.dashed ? ' dashed' : '') }, svg).style.stroke = c;
      } else if (s.type === 'dots') {
        s.points.forEach(function (p) {
          var dot = el('circle', { cx: X(p[0]), cy: Y(p[1]), r: s.r || 4, class: s.hollow ? 'dot hollow' : 'dot' }, svg);
          if (s.hollow) dot.style.stroke = c; else dot.style.fill = c;
        });
      }
    });

    // ---------- 滑鼠懸停 ----------
    var tip = el('div', { class: 'lab-tip', hidden: '' }, wrap);
    var cross = el('line', { y1: m.t, y2: H - m.b, class: 'cross', visibility: 'hidden' }, svg);
    var hasLine = cfg.series.some(function (s) { return s.type === 'line' || s.type === 'bars'; });
    var allDots = [];
    cfg.series.forEach(function (s) { if (s.type === 'dots' && s.label) s.points.forEach(function (p) { allDots.push({ p: p, s: s }); }); });
    function row(s, text) {
      var r = el('div', { class: 'tip-row' }, tip);
      el('span', { class: 'sw sw-' + s.type + (s.hollow ? ' sw-hollow' : '') }, r).style.setProperty('--c', ROLE[s.role] || ROLE.muted);
      el('span', {}, r, s.label + '　');
      el('b', {}, r, text);
    }
    svg.addEventListener('pointermove', function (e) {
      var box = svg.getBoundingClientRect();
      var px = (e.clientX - box.left) / box.width * W, py = (e.clientY - box.top) / box.height * H;
      tip.innerHTML = '';
      var anchorX;
      if (hasLine) {
        var i = Math.round(x0 + (px - m.l) / (W - m.l - m.r) * (x1 - x0));
        i = Math.max(Math.ceil(x0), Math.min(Math.floor(x1), i));
        el('div', { class: 'tip-head' }, tip, (cfg.xLabel || 'x') + ' ' + i);
        cfg.series.forEach(function (s) {
          if ((s.type === 'line' || s.type === 'bars') && s.label && s.y[i] != null) row(s, fmt(s.y[i], cfg.digits));
          if (s.type === 'band' && s.label && s.lo[i] != null) row(s, fmt(s.lo[i], cfg.digits) + ' ~ ' + fmt(s.hi[i], cfg.digits));
          if (s.type === 'dots' && s.label && s.points.some(function (p) { return p[0] === i; })) row(s, '✓');
        });
        anchorX = X(i);
        cross.setAttribute('x1', anchorX); cross.setAttribute('x2', anchorX); cross.setAttribute('visibility', 'visible');
      } else if (allDots.length) {
        var best = null, bd = 1e9;
        allDots.forEach(function (d) {
          var dist = Math.hypot(X(d.p[0]) - px, Y(d.p[1]) - py);
          if (dist < bd) { bd = dist; best = d; }
        });
        if (bd > 40) { tip.hidden = true; return; }
        row(best.s, '(' + fmt(best.p[0], cfg.digits) + ', ' + fmt(best.p[1], cfg.digits) + ')');
        anchorX = X(best.p[0]);
      } else return;
      tip.hidden = false;
      var left = anchorX / W * box.width;
      tip.style.left = Math.min(Math.max(left + 12, 0), box.width - tip.offsetWidth - 4) + 'px';
      if (left + 12 + tip.offsetWidth > box.width) tip.style.left = Math.max(left - tip.offsetWidth - 12, 0) + 'px';
    });
    svg.addEventListener('pointerleave', function () { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
  }

  // ---------- 實驗容器 ----------
  function mount(root, fn) {
    root.innerHTML = '';
    var controls = el('div', { class: 'lab-controls' }, root);
    var statsBox = el('div', { class: 'lab-stats' }, root);
    var charts = el('div', { class: 'lab-charts' }, root);
    var cap = el('p', { class: 'lab-caption', 'aria-live': 'polite' }, root);
    var slots = {}, handler = null;
    function fire() { if (handler) handler(); }

    var lab = {
      slider: function (o) {
        var box = el('label', { class: 'lab-control' }, controls);
        var head = el('span', { class: 'lab-control-head' }, box);
        el('span', {}, head, o.label);
        var out = el('output', {}, head);
        var input = el('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1, value: o.value }, box);
        function show() { out.textContent = o.format ? o.format(+input.value) : input.value; }
        input.addEventListener('input', function () { show(); fire(); });
        show();
        return function () { return +input.value; };
      },
      select: function (o) {
        var box = el('label', { class: 'lab-control' }, controls);
        el('span', { class: 'lab-control-head' }, box, o.label);
        var sel = el('select', {}, box);
        o.options.forEach(function (op) { el('option', { value: op.value }, sel, op.label); });
        if (o.value != null) sel.value = o.value;
        sel.addEventListener('change', fire);
        return function () { return sel.value; };
      },
      onChange: function (fn2) { handler = fn2; fn2(); },
      stats: function (items) {
        statsBox.innerHTML = '';
        items.forEach(function (it) {
          var tile = el('div', { class: 'lab-stat' }, statsBox);
          var lbl = el('div', { class: 'lab-stat-label' }, tile);
          if (it.tone) el('span', { class: 'sw sw-dots' }, lbl).style.setProperty('--c', ROLE[it.tone]);
          el('span', {}, lbl, it.label);
          el('div', { class: 'lab-stat-value' }, tile, String(it.value));
          if (it.note) el('div', { class: 'lab-stat-note' }, tile, it.note);
        });
      },
      caption: function (t) { cap.textContent = t; },
      chart: function (cfg) {
        var key = cfg.slot || 'main';
        if (!slots[key]) slots[key] = el('div', { class: 'lab-chart' }, charts);
        drawChart(slots[key], cfg);
      }
    };
    fn(lab);
  }

  function boot() {
    document.querySelectorAll('[data-demo]').forEach(function (root) {
      var fn = registry[root.getAttribute('data-demo')];
      if (fn) mount(root, fn);
      else root.textContent = '找不到互動實驗：' + root.getAttribute('data-demo');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);

  window.Lab = {
    register: function (slug, fn) { registry[slug] = fn; },
    random: random, mean: mean, std: std, median: median, mad: mad, quantile: quantile,
    rollingMean: rollingMean, rollingStd: rollingStd, rollingMedian: rollingMedian,
    rolling: rolling, acf: acf, pearson: pearson, spearman: spearman, cumsum: cumsum, normalCdf: normalCdf, fmt: fmt
  };
})();
