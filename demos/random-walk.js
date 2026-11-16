// 互動實驗：隨機漫步 — 純粹丟銅板也會走出「趨勢」
Lab.register('random-walk', function (lab) {
  var N = 250;
  var seed = lab.slider({ id: 'seed', label: '換一條路徑', min: 1, max: 30, step: 1, value: 1, format: function (v) { return '第 ' + v + ' 條'; } });
  var drift = lab.slider({ id: 'drift', label: '每一步的平均偏移', min: 0, max: 0.3, step: 0.05, value: 0, format: function (v) { return v === 0 ? '0（公平）' : '+' + v.toFixed(2); } });

  lab.onChange(function () {
    var rng = Lab.random(seed() * 97), step = [];
    for (var i = 0; i < N; i++) step.push(rng.normal() + drift());
    var pos = Lab.cumsum(step);
    var up = step.filter(function (v) { return v > 0; }).length / N;
    var run = 0, best = 0;
    step.forEach(function (v) { run = v > 0 ? run + 1 : 0; best = Math.max(best, run); });
    var r1 = Lab.acf(step, 1)[1];

    lab.stats([
      { label: '往上走的步數比例', value: Lab.fmt(up * 100, 0) + '%', tone: 'alt' },
      { label: '最長連續往上', value: best + ' 步', tone: 'alt' },
      { label: '最後停在', value: Lab.fmt(pos[N - 1], 1), tone: 'data', note: '起點是 0' },
      { label: '這一步和上一步的相關', value: Lab.fmt(r1), tone: 'alt', note: '接近 0 代表互不相干' }
    ]);
    lab.chart({ slot: 'pos', title: '位置：把每一步加總起來（隨機漫步）', xLabel: '第幾步', yLabel: '位置', digits: 2,
      series: [{ type: 'line', role: 'data', y: pos, label: '位置' }] });
    lab.chart({ slot: 'step', title: '每一步走多少（白噪音）', height: 200, xLabel: '第幾步', yLabel: '步幅', digits: 2,
      series: [{ type: 'line', role: 'alt', y: step, label: '每一步' }] });
    lab.caption(drift() === 0
      ? '每一步都是公平的隨機數，上下各半，但加總起來的位置卻走出了像「趨勢」的形狀。多換幾條路徑看看。'
      : '加上一點點偏移之後，長期會往上漂，但單看任何一小段，還是分不出是偏移還是運氣。');
  });
});
