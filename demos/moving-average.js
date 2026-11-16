// 互動實驗：移動平均 — 落後、盤整時的假訊號、單根異常值的殘影
Lab.register('moving-average', function (lab) {
  var N = 300, T0 = 100, T1 = 200, SLOPE = 0.4, SPIKE_AT = 50;

  var win = lab.slider({ id: 'win', label: '視窗長度 N', min: 5, max: 80, step: 1, value: 20, format: function (v) { return v + ' 根'; } });
  var noise = lab.slider({ id: 'noise', label: '雜訊大小', min: 0, max: 4, step: 0.1, value: 1.5, format: function (v) { return v.toFixed(1); } });
  var spike = lab.slider({ id: 'spike', label: '第 50 根的異常跳動', min: 0, max: 40, step: 1, value: 20, format: function (v) { return '+' + v; } });

  lab.onChange(function () {
    var rng = Lab.random(11), n = win(), price = [], base = [];
    for (var i = 0; i < N; i++) {
      var level = 100 + (i <= T0 ? 0 : i <= T1 ? (i - T0) * SLOPE : (T1 - T0) * SLOPE);
      base.push(level);
      price.push(level + rng.normal() * noise() + (i === SPIKE_AT ? spike() : 0));
    }
    var sma = Lab.rollingMean(price, n), med = Lab.rollingMedian(price, n);

    // 趨勢段的平均落後根數：均線比真實水準低多少，換算成幾根
    var lagSum = 0, lagN = 0;
    for (var a = T0 + n; a <= T1; a++) { lagSum += (base[a] - sma[a]) / SLOPE; lagN++; }
    // 盤整段（最後 100 根）價格穿越均線的次數
    var cross = 0;
    for (var b = T1 + n + 1; b < N; b++) if ((price[b] - sma[b]) * (price[b - 1] - sma[b - 1]) < 0) cross++;
    // 異常值對兩條線的最大影響
    var smaBump = 0, medBump = 0;
    for (var c = SPIKE_AT; c < SPIKE_AT + n && c < T0; c++) {
      smaBump = Math.max(smaBump, sma[c] - 100); medBump = Math.max(medBump, med[c] - 100);
    }

    lab.stats([
      { label: '趨勢段平均落後', value: lagN ? Lab.fmt(lagSum / lagN, 1) + ' 根' : '—', tone: 'classic', note: '理論值 (N − 1) / 2 = ' + Lab.fmt((n - 1) / 2, 1) },
      { label: '盤整段穿越均線次數', value: cross + ' 次', tone: 'classic', note: '每一次都是一個「訊號」' },
      { label: '異常值把均線抬高', value: '+' + Lab.fmt(smaBump), tone: 'classic', note: '持續 ' + n + ' 根後突然消失' },
      { label: '異常值把滾動中位數抬高', value: '+' + Lab.fmt(medBump), tone: 'robust' }
    ]);
    lab.chart({
      title: '模擬價格：前段盤整（第 50 根有一次異常跳動）→ 中段上漲 → 後段盤整',
      xLabel: '第幾根 K 線', yLabel: '價格', digits: 2,
      series: [
        { type: 'line', role: 'data', y: price, label: '價格' },
        { type: 'line', role: 'classic', y: sma, label: n + ' 期簡單移動平均' },
        { type: 'line', role: 'robust', y: med, label: n + ' 期滾動中位數', dashed: true }
      ]
    });
    lab.caption('N = ' + n + ' 時，均線在上漲段平均落後約 ' + (lagN ? Lab.fmt(lagSum / lagN, 1) : '—') + ' 根；把 N 調小可以減少落後，但盤整段的穿越次數會變多。兩件事無法同時改善。');
  });
});
