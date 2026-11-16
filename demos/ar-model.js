// 互動實驗：AR(1) — 一次衝擊要多久才會消失？記憶力到 1 就永遠不會消失
Lab.register('ar-model', function (lab) {
  var N = 160, T = 60;
  var phi = lab.slider({ id: 'phi', label: '記憶力（φ）', min: 0, max: 1, step: 0.05, value: 0.8, format: function (v) { return v.toFixed(2); } });
  var shock = lab.slider({ id: 'shock', label: '第 60 天的突發衝擊', min: 0, max: 10, step: 1, value: 8, format: function (v) { return '+' + v; } });

  lab.onChange(function () {
    var rng = Lab.random(31), p = phi(), x = [0], decay = [];
    for (var i = 1; i < N; i++) x.push(p * x[i - 1] + rng.normal() + (i === T ? shock() : 0));
    for (var j = 0; j < N; j++) decay.push(j < T ? null : shock() * Math.pow(p, j - T));
    var half = p <= 0 ? 0 : p >= 1 ? Infinity : Math.log(0.5) / Math.log(p);
    var left10 = Math.pow(p, 10) * 100;

    lab.stats([
      { label: '衝擊的半衰期', value: half === Infinity ? '永遠不會' : half === 0 ? '立刻消失' : Lab.fmt(half, 1) + ' 天', tone: 'model', note: '影響剩下一半所需的時間' },
      { label: '10 天後還剩', value: Lab.fmt(left10, left10 < 10 ? 1 : 0) + '%', tone: 'model' },
      { label: '實際量到的記憶力', value: Lab.fmt(Lab.acf(x.slice(0, T), 1)[1]), tone: 'data', note: '用衝擊前的 60 天估計' }
    ]);
    lab.chart({ title: '一條 AR(1) 序列，在第 60 天被推了一把', xLabel: '第幾天', yLabel: '數值', digits: 2,
      series: [
        { type: 'line', role: 'data', y: x, label: '實際走勢' },
        { type: 'line', role: 'model', y: decay, label: '模型預期的衝擊殘留', dashed: true },
        { type: 'hline', role: 'muted', y: 0, label: '長期平均' }
      ] });
    lab.caption(p >= 1 ? '記憶力等於 1：衝擊永遠不會消退，序列不再有固定的平均可以回去。這就是隨機漫步。'
      : p === 0 ? '記憶力是 0：衝擊只影響當天，隔天就完全不見。這就是白噪音。'
      : '記憶力 ' + p.toFixed(2) + '：衝擊每天剩下前一天的 ' + Math.round(p * 100) + '%，大約 ' + Lab.fmt(half, 1) + ' 天後剩一半。');
  });
});
