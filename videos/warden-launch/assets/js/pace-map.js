/* Measured narration drives the picture. Each pair is [source pose time, output time]. */
(function(global){
  const legacyPoints = [[0, 0], [0.28, 0.28], [0.72, 0.72], [1.15, 1.17], [1.46, 1.46], [2, 1.95], [2.25, 2.12], [2.8, 2.52], [3.22, 2.94], [3.54, 3.45], [4, 3.94], [5, 4.66], [6, 5.43], [6.58, 6.78], [7.3, 8.15], [7.7, 8.55], [7.9, 8.78], [8, 8.9], [10, 10.15], [10.06, 10.25], [10.7, 10.85], [10.82, 10.98], [11.26, 11.18], [11.7, 11.5], [12, 11.7], [14, 12.6], [16, 14.4], [16.18, 14.55], [18, 15.8], [20, 17.4], [22, 18.9], [26, 22.95], [26.15, 23.1], [26.51, 23.4], [27.48, 24.1], [28, 24.47], [32, 28]];
  const removed = [[6.615, 6.865], [8.605, 8.775], [10.700, 10.780], [11.365, 11.665], [21.000, 22.100]];
  function fromLegacy(value) {
    return value - removed.reduce((sum, [start, end]) => sum + Math.max(0, Math.min(value, end) - start), 0);
  }
  const points = legacyPoints.map(([source, output]) => [source, fromLegacy(output)]);
  function map(value, input, output, table = points) {
    if (value <= table[0][input]) return table[0][output];
    for (let i = 1; i < table.length; i++) {
      const a = table[i - 1], b = table[i];
      if (value <= b[input]) return a[output] + (b[output] - a[output]) * (value - a[input]) / (b[input] - a[input]);
    }
    return table[table.length - 1][output];
  }
  global.wardenPace = {duration:26.1, points, legacyPoints, removed, fromLegacy, toSource:t=>map(t,1,0), toOutput:t=>map(t,0,1), toLegacyOutput:t=>map(t,0,1,legacyPoints)};
})(window);
