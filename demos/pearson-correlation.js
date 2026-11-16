// 互動實驗：皮爾森相關係數 — 一個離群點製造相關、曲線關係被看成無關
Lab.register('pearson-correlation', function (lab) {
  var N = 60;

  var shape = lab.select({ id: 'shape', label: '兩個變數的真實關係', value: 'none', options: [
    { value: 'none', label: '完全無關' },
    { value: 'linear', label: '線性相關（加上雜訊）' },
    { value: 'curve', label: 'U 形曲線（強烈但非線性）' }
  ] });
  var far = lab.slider({ id: 'far', label: '加入一個離群點，距離', min: 0, max: 12, step: 0.5, value: 8, format: function (v) { return v === 0 ? '不加入' : v.toFixed(1) + ' 個標準差'; } });

  function theilSen(x, y) {
    var slopes = [];
    for (var i = 0; i < x.length; i++) for (var j = i + 1; j < x.length; j++) if (x[j] !== x[i]) slopes.push((y[j] - y[i]) / (x[j] - x[i]));
    var b = Lab.median(slopes);
    return { b: b, a: Lab.median(y.map(function (v, i) { return v - b * x[i]; })) };
  }
  function ols(x, y) {
    var mx = Lab.mean(x), my = Lab.mean(y), sxy = 0, sxx = 0;
    for (var i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); }
    return { b: sxy / sxx, a: my - sxy / sxx * mx };
  }

  lab.onChange(function () {
    var rng = Lab.random(5), x = [], y = [], s = shape();
    for (var i = 0; i < N; i++) {
      var xi = rng.normal(), e = rng.normal();
      x.push(xi);
      y.push(s === 'linear' ? 0.6 * xi + 0.8 * e : s === 'curve' ? xi * xi - 1 + 0.3 * e : e);
    }
    var cleanR = Lab.pearson(x, y), pts = x.map(function (v, i) { return [v, y[i]]; });
    var outlier = [];
    if (far() > 0) { x.push(far()); y.push(far()); outlier = [[far(), far()]]; }

    var r = Lab.pearson(x, y), rho = Lab.spearman(x, y);
    var f1 = ols(x, y), f2 = theilSen(x, y);
    var xa = Math.min.apply(null, x), xb = Math.max.apply(null, x);

    lab.stats([
      { label: '皮爾森 r', value: Lab.fmt(r), tone: 'classic', note: 'r² = ' + Lab.fmt(r * r) },
      { label: '斯皮爾曼 ρ', value: Lab.fmt(rho), tone: 'robust' },
      { label: '拿掉離群點後的 r', value: Lab.fmt(cleanR), tone: 'data', note: N + ' 個原始資料點' }
    ]);
    lab.chart({
      title: N + ' 個模擬資料點' + (outlier.length ? '，外加 1 個離群點' : ''),
      xLabel: '變數 X', yLabel: '變數 Y', digits: 2, padX: true, height: 340,
      series: [
        { type: 'dots', role: 'data', points: pts, label: '原始資料', r: 4 },
        { type: 'dots', role: 'classic', points: outlier, label: '離群點', r: 7 },
        { type: 'path', role: 'classic', points: [[xa, f1.a + f1.b * xa], [xb, f1.a + f1.b * xb]], label: '最小平方法迴歸線' },
        { type: 'path', role: 'robust', points: [[xa, f2.a + f2.b * xa], [xb, f2.a + f2.b * xb]], label: 'Theil–Sen 穩健迴歸線', dashed: true }
      ]
    });
    var msg;
    if (s === 'curve' && !outlier.length) msg = 'Y 幾乎完全由 X 決定，但因為關係不是直線，r 只有 ' + Lab.fmt(r) + '。「相關係數接近 0」不等於「沒有關係」。';
    else if (outlier.length && Math.abs(r - cleanR) > 0.2) msg = '61 個點裡只有 1 個離群點，就把 r 從 ' + Lab.fmt(cleanR) + ' 變成 ' + Lab.fmt(r) + '；斯皮爾曼 ρ 只看排名，停在 ' + Lab.fmt(rho) + '。';
    else msg = '目前離群點的影響不大。把距離拉遠，或把關係切換成「完全無關」再看一次。';
    lab.caption(msg);
  });
});
