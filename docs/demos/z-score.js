// 互動實驗：z-score 離群值偵測 — 離群值如何把 σ 撐大，讓自己躲過偵測
Lab.register('z-score', function (lab) {
  var N = 250;
  var POS = [40, 95, 130, 170, 205, 60, 220, 15];
  var SCALE = [1, 0.2, 0.7, 0.18, 0.85, 0.22, 0.55, 0.25];

  var count = lab.slider({ id: 'count', label: '植入的極端事件數', min: 0, max: 8, step: 1, value: 5 });
  var size = lab.slider({ id: 'size', label: '最大事件的幅度', min: 5, max: 40, step: 1, value: 25, format: function (v) { return '±' + v + '%'; } });
  var df = lab.slider({ id: 'df', label: '尾巴厚度（t 分布自由度）', min: 3, max: 30, step: 1, value: 5, format: function (v) { return v + (v <= 5 ? '（厚尾）' : v >= 20 ? '（接近常態）' : ''); } });
  var k = lab.slider({ id: 'k', label: '門檻 k', min: 2, max: 4, step: 0.1, value: 3, format: function (v) { return v.toFixed(1); } });

  lab.onChange(function () {
    var rng = Lab.random(7), x = [];
    for (var i = 0; i < N; i++) x.push(rng.studentT(df()) * 1.5);
    var planted = POS.slice(0, count());
    planted.forEach(function (p, j) { x[p] = (j % 2 ? -1 : 1) * size() * SCALE[j]; });

    var mu = Lab.mean(x), sd = Lab.std(x);
    var med = Lab.median(x), rs = 1.4826 * Lab.mad(x);
    var cFlag = [], rFlag = [], cHit = 0, rHit = 0;
    x.forEach(function (v, i) {
      var isPlanted = planted.indexOf(i) >= 0;
      if (Math.abs(v - mu) / sd > k()) { cFlag.push([i, v]); if (isPlanted) cHit++; }
      if (Math.abs(v - med) / rs > k()) { rFlag.push([i, v]); if (isPlanted) rHit++; }
    });

    lab.stats([
      { label: '標準差 σ', value: Lab.fmt(sd) + '%', tone: 'classic', note: '沒有極端事件時約 1.5%' },
      { label: '穩健尺度 1.4826 × MAD', value: Lab.fmt(rs) + '%', tone: 'robust' },
      { label: '傳統 z-score 抓到', value: cHit + ' / ' + planted.length, tone: 'classic', note: '共標記 ' + cFlag.length + ' 個點' },
      { label: '穩健 z-score 抓到', value: rHit + ' / ' + planted.length, tone: 'robust', note: '共標記 ' + rFlag.length + ' 個點' }
    ]);
    lab.chart({
      title: '250 天的模擬日報酬率，以及兩種方法各自標記的離群值',
      xLabel: '第幾天', yLabel: '日報酬率 (%)', digits: 2,
      series: [
        { type: 'line', role: 'data', y: x, label: '日報酬率' },
        { type: 'dots', role: 'robust', points: rFlag, label: '穩健 z-score 標記', hollow: true, r: 8 },
        { type: 'dots', role: 'classic', points: cFlag, label: '傳統 z-score 標記', r: 4 }
      ]
    });
    var missed = planted.length - cHit;
    lab.caption(planted.length === 0
      ? '沒有植入事件時，兩種尺度差不多；差別只來自資料本身的厚尾。'
      : missed > 0
        ? '極端事件把 σ 撐大到 ' + Lab.fmt(sd) + '%，結果有 ' + missed + ' 個植入事件的 |z| 掉到門檻以下，傳統方法看不到它們；MAD 幾乎不受影響。'
        : '目前傳統方法全部抓到了。試著把事件數或幅度調大，看 σ 怎麼被撐大。');
  });
});
