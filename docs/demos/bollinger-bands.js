// 互動實驗：布林通道 —「95% 落在通道內」與「碰上軌就回檔」為什麼不成立
Lab.register('bollinger-bands', function (lab) {
  var N = 400, PATHS = 30;

  var win = lab.slider({ id: 'win', label: '視窗長度 N', min: 10, max: 60, step: 1, value: 20, format: function (v) { return v + ' 根'; } });
  var k = lab.slider({ id: 'k', label: '通道寬度 k', min: 1, max: 3, step: 0.1, value: 2, format: function (v) { return v.toFixed(1) + ' σ'; } });
  var drift = lab.slider({ id: 'drift', label: '趨勢強度（每根平均漲幅）', min: 0, max: 0.5, step: 0.05, value: 0.2, format: function (v) { return v.toFixed(2) + '%'; } });
  var cluster = lab.slider({ id: 'cluster', label: '波動叢聚程度', min: 0, max: 0.95, step: 0.05, value: 0.9, format: function (v) { return v.toFixed(2); } });

  lab.onChange(function () {
    var n = win(), kk = k(), p = cluster(), d = drift();
    // 類 GARCH(1,1)：今天的變異數 = 長期水準 + 昨天衝擊 + 昨天變異數
    function simulate(seed) {
      var rng = Lab.random(seed), price = [100], v = 1, alpha = p * 0.15, beta = p * 0.85;
      for (var i = 1; i < N; i++) {
        var e = rng.studentT(5) * Math.sqrt(v);
        v = (1 - p) + alpha * e * e + beta * v;
        price.push(price[i - 1] * (1 + (d + e) / 100));
      }
      var mid = Lab.rollingMean(price, n), sd = Lab.rollingStd(price, n);
      return {
        price: price,
        hi: mid.map(function (m, i) { return m == null ? null : m + kk * sd[i]; }),
        lo: mid.map(function (m, i) { return m == null ? null : m - kk * sd[i]; })
      };
    }
    // 圖上畫第一條路徑；統計數字合計 PATHS 條路徑，避免單一路徑的運氣成分
    var shown = simulate(23), price = shown.price, hi = shown.hi, lo = shown.lo;
    var rmed = Lab.rollingMedian(price, n);
    var rmad = Lab.rolling(price, n, function (w) { return 1.4826 * Lab.mad(w); });
    var rhi = rmed.map(function (m, i) { return m == null ? null : m + kk * rmad[i]; });
    var rlo = rmed.map(function (m, i) { return m == null ? null : m - kk * rmad[i]; });

    var out = 0, total = 0, touch = 0, cont = 0, best = 0, breaks = 0, touches = [];
    for (var s = 0; s < PATHS; s++) {
      var sim = s === 0 ? shown : simulate(23 + s * 101), streak = 0;
      for (var t = n - 1; t < N; t++) {
        total++;
        var above = sim.price[t] > sim.hi[t];
        if (above || sim.price[t] < sim.lo[t]) out++;
        if (above) {
          streak++; best = Math.max(best, streak); breaks++;
          if (s === 0) touches.push([t, sim.price[t]]);
          if (t + 5 < N) { touch++; if (sim.price[t + 5] > sim.price[t]) cont++; }
        } else streak = 0;
      }
    }
    var theory = 2 * (1 - Lab.normalCdf(kk)) * 100;

    lab.stats([
      { label: '收盤在通道外的比例', value: Lab.fmt(out / total * 100, 1) + '%', tone: 'classic', note: '「常態」說法的理論值 ' + Lab.fmt(theory, 1) + '%' },
      { label: '突破上軌的次數', value: breaks + ' 次', tone: 'classic', note: PATHS + ' 條模擬路徑合計' },
      { label: '突破上軌後 5 根仍上漲', value: touch ? Lab.fmt(cont / touch * 100, 0) + '%' : '—', tone: 'classic', note: '若「碰上軌就回檔」成立，應該遠低於 50%' },
      { label: '最長連續貼在上軌外', value: best + ' 根', tone: 'classic' }
    ]);
    lab.chart({
      title: '模擬價格、布林通道，以及用中位數與 MAD 計算的穩健通道',
      xLabel: '第幾根 K 線', yLabel: '價格', digits: 2,
      series: [
        { type: 'band', role: 'classic', lo: lo, hi: hi, label: '布林通道（均線 ± kσ）' },
        { type: 'line', role: 'robust', y: rhi, label: '穩健通道上緣', dashed: true },
        { type: 'line', role: 'robust', y: rlo, dashed: true },
        { type: 'line', role: 'data', y: price, label: '價格' },
        { type: 'dots', role: 'classic', points: touches, label: '收盤突破上軌', r: 3 }
      ]
    });
    lab.caption('圖上是其中一條路徑，數字合計 ' + PATHS + ' 條。趨勢強度 ' + d.toFixed(2) + '% 時，突破上軌後 5 根有 ' + (touch ? Lab.fmt(cont / touch * 100, 0) : '—') + '% 的機率價格更高。把趨勢調到 0，再調到 0.5，看這個數字怎麼變。');
  });
});
