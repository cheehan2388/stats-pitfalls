// 首頁的迷你實驗：最大的離群值越大，第二大的事件越不像離群值
Lab.register('hero', function (lab) {
  var big = lab.slider({ id: 'big', label: '最大那根跳動的幅度', min: 6, max: 40, step: 1, value: 12, format: function (v) { return '+' + v + '%'; } });
  lab.onChange(function () {
    var rng = Lab.random(3), x = [];
    for (var i = 0; i < 120; i++) x.push(rng.normal() * 1.2);
    x[38] = -6; x[82] = big();
    var mu = Lab.mean(x), sd = Lab.std(x), z = Math.abs(x[38] - mu) / sd;
    var rz = Math.abs(x[38] - Lab.median(x)) / (1.4826 * Lab.mad(x));
    lab.stats([
      { label: '−6% 那一天的 z 分數', value: Lab.fmt(z, 1), tone: 'classic', note: z > 3 ? '超過 3，被標記' : '低於 3，沒被標記' },
      { label: '同一天的穩健 z 分數', value: Lab.fmt(rz, 1), tone: 'robust', note: '用中位數與 MAD 計算' }
    ]);
    lab.chart({
      height: 220, xLabel: '第幾天', digits: 2,
      series: [
        { type: 'line', role: 'data', y: x, label: '日報酬率 (%)' },
        { type: 'dots', role: z > 3 ? 'classic' : 'muted', points: [[38, -6]], label: '−6% 那一天', r: 6 }
      ]
    });
    lab.caption(z > 3 ? '−6% 是明顯的異常，z-score 抓得到。' : '同一個 −6%，只因為別處出現更大的跳動，就不再算「異常」了。');
  });
});
