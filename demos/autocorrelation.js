// 互動實驗：自相關 — 記憶力越強，自相關圖的直條越高、降得越慢；樣本太少時會出現假的直條
Lab.register('autocorrelation', function (lab) {
  var LAGS = 20;
  var phi = lab.slider({ id: 'phi', label: '記憶力（φ）', min: -0.9, max: 0.9, step: 0.1, value: 0.6, format: function (v) { return v.toFixed(1); } });
  var n = lab.slider({ id: 'n', label: '資料有幾天', min: 50, max: 1000, step: 50, value: 200, format: function (v) { return v + ' 天'; } });

  lab.onChange(function () {
    var rng = Lab.random(19), x = [0], p = phi();
    for (var i = 1; i < n(); i++) x.push(p * x[i - 1] + rng.normal());
    var a = Lab.acf(x, LAGS), bound = 1.96 / Math.sqrt(n()), outside = 0;
    for (var k = 1; k <= LAGS; k++) if (Math.abs(a[k]) > bound) outside++;

    lab.stats([
      { label: '和 1 天前的相關', value: Lab.fmt(a[1]), tone: 'data', note: '設定的記憶力是 ' + p.toFixed(1) },
      { label: '和 5 天前的相關', value: Lab.fmt(a[5]), tone: 'data', note: '理論值 ' + Lab.fmt(Math.pow(p, 5)) },
      { label: '超出虛線的直條', value: outside + ' / ' + LAGS, tone: 'model', note: '虛線是 ±' + Lab.fmt(bound) }
    ]);
    lab.chart({ slot: 'series', title: '資料本身', height: 220, xLabel: '第幾天', digits: 2,
      series: [{ type: 'line', role: 'data', y: x, label: '數值' }] });
    lab.chart({ slot: 'acf', title: '自相關圖：今天和 k 天前有多像', height: 260, xLabel: '相隔幾天（k）', yLabel: '相關係數', digits: 2, yMin: -1, yMax: 1,
      series: [
        { type: 'bars', role: 'data', y: a, label: '自相關' },
        { type: 'hline', role: 'model', y: bound, label: '「可能只是運氣」的範圍' },
        { type: 'hline', role: 'model', y: -bound }
      ] });
    lab.caption(p === 0
      ? '記憶力是 0，理論上所有直條都該是 0。這次有 ' + outside + ' 根超出虛線；即使完全沒有記憶，20 根裡平均也會有 1 根純粹因為運氣而超出。'
      : p > 0 ? '記憶力為正：直條一路往下降，每多隔一天，相關就再乘上 ' + p.toFixed(1) + '。'
      : '記憶力為負：今天高、明天就偏低，直條一正一負交替出現。');
  });
});
