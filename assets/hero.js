// 首頁的迷你實驗：同一批隨機衝擊，「記憶力」不同，長出來的序列完全不同
Lab.register('hero', function (lab) {
  var phi = lab.slider({ id: 'phi', label: '記憶力（今天保留昨天的幾成）', min: 0, max: 1, step: 0.05, value: 0.5, format: function (v) { return Math.round(v * 100) + '%'; } });
  lab.onChange(function () {
    var rng = Lab.random(8), x = [0], p = phi();
    for (var i = 1; i < 200; i++) x.push(p * x[i - 1] + rng.normal());
    var r1 = Lab.acf(x, 1)[1];
    lab.stats([
      { label: '今天和昨天有多像', value: Lab.fmt(r1), tone: 'data', note: '0 是毫無關係，1 是幾乎一樣' }
    ]);
    lab.chart({ height: 230, xLabel: '第幾天', digits: 2, series: [{ type: 'line', role: 'data', y: x, label: '數值' }] });
    lab.caption(p === 0 ? '完全不記得昨天：每天都是全新的隨機數，這叫白噪音。'
      : p < 1 ? '記得一部分：被推離平均之後，會慢慢被拉回來。這就是 AR 模型。'
      : '完全記得：每一次衝擊都永遠留著，數值越漂越遠。這叫隨機漫步。');
  });
});
