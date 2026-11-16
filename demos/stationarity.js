// 互動實驗：平穩性 — 價格不平穩，每日變動才平穩；波動改變時連變動也不平穩
Lab.register('stationarity', function (lab) {
  var N = 300, H = N / 2;
  var seed = lab.slider({ id: 'seed', label: '換一組資料', min: 1, max: 30, step: 1, value: 6, format: function (v) { return '第 ' + v + ' 組'; } });
  var boost = lab.slider({ id: 'boost', label: '後半段的波動放大', min: 1, max: 4, step: 0.5, value: 1, format: function (v) { return v === 1 ? '不放大' : v + ' 倍'; } });

  lab.onChange(function () {
    var rng = Lab.random(seed() * 131), chg = [];
    for (var i = 0; i < N; i++) chg.push(rng.normal() * (i >= H ? boost() : 1));
    var level = Lab.cumsum(chg).map(function (v) { return v + 100; });
    function halves(a) { return [a.slice(0, H), a.slice(H)]; }
    var L = halves(level), C = halves(chg);
    var lm = [Lab.mean(L[0]), Lab.mean(L[1])], cm = [Lab.mean(C[0]), Lab.mean(C[1])], cs = [Lab.std(C[0]), Lab.std(C[1])];
    function seg(m, a, b) { return { type: 'path', role: 'model', points: [[a, m], [b, m]], label: a === 0 ? '前半段與後半段各自的平均' : undefined }; }

    lab.stats([
      { label: '水準：前後半平均差', value: Lab.fmt(Math.abs(lm[1] - lm[0]), 1), tone: 'data', note: '前 ' + Lab.fmt(lm[0], 1) + ' → 後 ' + Lab.fmt(lm[1], 1) },
      { label: '每日變動：前後半平均差', value: Lab.fmt(Math.abs(cm[1] - cm[0]), 2), tone: 'alt', note: '前 ' + Lab.fmt(cm[0], 2) + ' → 後 ' + Lab.fmt(cm[1], 2) },
      { label: '每日變動的波動', value: Lab.fmt(cs[0], 2) + ' → ' + Lab.fmt(cs[1], 2), tone: 'alt', note: '前半段 → 後半段的標準差' }
    ]);
    lab.chart({ slot: 'level', title: '水準（像價格）：把每日變動累加起來', xLabel: '第幾天', yLabel: '水準', digits: 2,
      series: [{ type: 'line', role: 'data', y: level, label: '水準' }, seg(lm[0], 0, H - 1), seg(lm[1], H, N - 1)] });
    lab.chart({ slot: 'chg', title: '每日變動（像報酬率）', height: 220, xLabel: '第幾天', yLabel: '變動', digits: 2,
      series: [{ type: 'line', role: 'alt', y: chg, label: '每日變動' }, seg(cm[0], 0, H - 1), seg(cm[1], H, N - 1)] });
    lab.caption(boost() === 1
      ? '同一份資料：水準的平均前後差了 ' + Lab.fmt(Math.abs(lm[1] - lm[0]), 1) + '，每日變動的平均幾乎沒變。前者不平穩，後者平穩。'
      : '後半段波動放大 ' + boost() + ' 倍後，每日變動的平均還是在 0 附近，但起伏的幅度變了。平均穩定不代表整個序列平穩。');
  });
});
