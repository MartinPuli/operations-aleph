/* Editorial reconstruction of Warden's native composer and draft-set components.
 * Sources: web/js/draft.js, web/js/draft-set.js, web/style.css.
 * A business-intent request produces proposed drafts; the administrator reviews
 * and activates the set. Example output is illustrative and requires a capable compiler. */
(function (global) {
  'use strict';
  global.createWardenPromptScene = function ({ canvas, width = 1920, height = 1080 }) {
    canvas.width = width; canvas.height = height;
    const c = canvas.getContext('2d');
    const P = { ink: '#17181c', ivory: '#f1ede3', paper: '#ffffff', line: '#eaeaed', muted: '#70747c', accent: '#1a1d23', sunken: '#f7f7f8', block: '#c5383d', blockBg: '#fcedee', review: '#96650f', reviewBg: '#fbf2e2', allow: '#2f8256', allowBg: '#edf6f1' };
    const clamp = n => Math.max(0, Math.min(1, n));
    const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
    const lerp = (a, b, n) => a + (b - a) * n;
    function shape(fill, fn, stroke, lw = 2) {
      c.beginPath(); fn(); if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
    }
    function box(x, y, w, h, r, fill, stroke) { shape(fill, () => c.roundRect(x, y, w, h, r), stroke); }
    function ellipse(x, y, rx, ry, fill) { shape(fill, () => c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)); }
    function text(str, x, y, size, fill = P.ink, weight = 550, align = 'left') {
      c.fillStyle = fill; c.textAlign = align; c.font = `${weight} ${size}px WardenDisplay, Inter, sans-serif`; c.fillText(str, x, y);
    }
    function line(points, color, lw = 2) {
      shape(null, () => { c.moveTo(...points[0]); points.slice(1).forEach(p => c.lineTo(...p)); }, color, lw);
    }
    function portrait(x, y) {
      c.save(); c.translate(x, y); ellipse(0, 0, 28, 28, '#e7dfcb');
      c.beginPath(); c.arc(0, 0, 28, 0, Math.PI * 2); c.clip();
      shape('#426c65', () => { c.moveTo(-30, 32); c.quadraticCurveTo(-20, 8, 0, 9); c.quadraticCurveTo(23, 9, 30, 32); });
      box(-5, 5, 10, 13, 3, '#ce9571'); ellipse(0, -4, 13, 17, '#edba92');
      shape('#3c393c', () => {
        c.moveTo(-14, -3); c.lineTo(-15, -15); c.quadraticCurveTo(-4, -29, 12, -17);
        c.lineTo(15, -3); c.lineTo(9, -10); c.lineTo(-9, -10); c.closePath();
      });
      line([[-9, -3], [-3, -3]], '#3c393c', 1.5); line([[3, -3], [9, -3]], '#3c393c', 1.5);
      line([[-3, 6], [3, 6]], '#9c684b', 1); c.restore();
    }
    function raisedPanel(x, y, w, h, r) {
      c.save(); c.shadowColor = '#17181c07'; c.shadowBlur = 15; c.shadowOffsetY = 6;
      box(x, y, w, h, r, P.paper, P.line); c.restore();
    }
    function cursor(x, y, scale = 1) {
      c.save(); c.translate(x, y); c.scale(scale, scale);
      shape(P.ink, () => { c.moveTo(0, 0); c.lineTo(2, 32); c.lineTo(10, 23); c.lineTo(23, 28); c.lineTo(27, 21); c.lineTo(14, 16); c.lineTo(25, 9); c.closePath(); }, P.paper, 2);
      c.restore();
    }
    function clickRing(x, y, elapsed) {
      if (elapsed < 0 || elapsed > .28) return;
      c.save(); c.globalAlpha = (1 - elapsed / .28) * .65;
      shape(null, () => c.arc(x, y, 13 + elapsed * 95, 0, Math.PI * 2), P.ink, 2.5); c.restore();
    }
    function renderAt(sourceTime, outputTime) {
      const n = Number.isFinite(outputTime) ? outputTime : global.wardenPace.toOutput(sourceTime);
      const out = value => 1 - Math.pow(1 - clamp(value), 4);
      const sendAt = 6.98, activateAt = 10.35, activeAt = 10.44;
      const collapse = ease((n - 7.05) / .22), active = n >= activeAt;
      const entry = out((n - 5.43) / .22);
      c.setTransform(width / 1920, 0, 0, height / 1080, 0, 0);
      c.clearRect(0, 0, 1920, 1080); c.lineCap = 'round'; c.lineJoin = 'round';
      const y = lerp(380, 244, collapse), h = lerp(340, 212, collapse);
      c.save(); c.translate(0, 54 * (1 - entry));
      raisedPanel(230, y, 1460, h, 22);
      text('You', 284, lerp(442, 298, collapse), 28, P.muted, 550);
      // Complete lines arrive together with the request, never letter by letter.
      const promptLines = [
        ['Help our team write client emails', 501, 355, 5.51],
        ['without exposing confidential information.', 564, 413, 5.61]
      ];
      promptLines.forEach(([copy, expanded, compact, at]) => {
        if (n < at) return;
        text(copy, 284, lerp(expanded, compact, collapse) + 22 * (1 - out((n - at) / .18)), lerp(49, 43, collapse), P.ink, 550);
      });
      if (n < 7.17) {
        const leave = out((n - 7.03) / .14);
        const press = Math.max(0, 1 - Math.abs(n - sendAt) / .09);
        c.save(); c.globalAlpha = 1 - leave;
        c.translate(1430, 641); c.scale(1 - .045 * press, 1 - .045 * press); c.translate(-1430, -641);
        box(1230, 595, 400, 91, 12, P.accent);
        text(n >= sendAt ? 'Sent' : 'Send', 1430, 656, 47, P.paper, 590, 'center');
        c.restore();
      }
      c.restore();

      // The submitted prompt visibly feeds the generated draft panel.
      if (n >= 7.21 && n < 7.76) {
        const travel = out((n - 7.21) / .24), fade = 1 - ease((n - 7.57) / .19);
        c.save(); c.globalAlpha = fade;
        line([[960, 464], [960, lerp(464, 520, travel)]], '#9cabc3', 3);
        box(954, lerp(464, 515, travel) - 5, 12, 10, 4, P.accent);
        c.restore();
      }
      if (n >= 7.26) {
        const panelIn = out((n - 7.26) / .21);
        c.save(); c.translate(0, 54 * (1 - panelIn));
        // A small press through the whole surface makes activation tactile.
        const latch = n >= activateAt && n < activeAt + .14 ? Math.sin(Math.PI * clamp((n - activateAt) / .23)) : 0;
        c.translate(960, 766); c.scale(1 - .007 * latch, 1 - .007 * latch); c.translate(-960, -766);
        text('Warden', 230, 501, 29, P.muted, 590);
        raisedPanel(230, 526, 1460, 480, 22);
        text('Rules drafted from your request', 284, 589, 38, P.ink, 590);
        box(1410, 554, 224, 47, 23, active ? P.allowBg : P.sunken);
        text(active ? 'Active' : 'Not active', 1522, 587, 29, active ? P.allow : P.muted, 590, 'center');
        const rules = [
          { label: 'BLOCK', name: 'Client contact details', color: P.block, bg: P.blockBg },
          { label: 'BLOCK', name: 'Bank account details', color: P.block, bg: P.blockBg },
          { label: 'REVIEW', name: 'Non-public pricing', color: P.review, bg: P.reviewBg }
        ];
        // Review focus follows the administrator's pointer; drafts remain inactive.
        const reviewStart = 8.52, rowStep = .30;
        const focus = n >= reviewStart && n < 9.59 ? Math.min(2, Math.floor((n - reviewStart) / rowStep)) : -1;
        rules.forEach((rule, i) => {
          const arrivalAt = 7.42 + i * .11;
          if (n < arrivalAt) return;
          const arrive = out((n - arrivalAt) / .20), rowY = 628 + i * 86;
          if (i > 0) line([[284, rowY - 13], [1634, rowY - 13]], P.line, 2);
          c.save(); c.beginPath(); c.rect(264, rowY - 8, 1390, 80); c.clip();
          c.translate(0, 74 * (1 - arrive));
          if (i === focus) {
            box(270, rowY - 6, 1375, 73, 10, '#f4f6f8');
            box(270, rowY - 6, 4, 73, 2, '#778da6');
          }
          box(284, rowY, 208, 60, 12, rule.bg);
          text(rule.label, 388, rowY + 42, 36, rule.color, 650, 'center');
          text(rule.name, 548, rowY + 43, 41, P.ink, 550);
          const statusIn = active ? out((n - activeAt - i * .04) / .12) : 0;
          if (active) {
            c.save(); c.globalAlpha = statusIn;
            box(1480, rowY + 1, 154, 56, 26, P.allowBg);
            c.restore();
          }
          text(active ? 'Active' : 'Draft', 1620, rowY + 43, 31, active ? P.allow : P.muted, 550, 'right');
          c.restore();
        });
        if (n >= 7.74) {
          const footer = out((n - 7.74) / .18);
          c.save(); c.globalAlpha = footer;
          line([[284, 886], [1634, 886]], P.line, 2);
          text('Applies to your team', 284, 960, 33, P.muted, 500);
          const press = Math.max(0, 1 - Math.abs(n - activateAt) / .09);
          c.save(); c.translate(1426, 950); c.scale(1 - .045 * press, 1 - .045 * press); c.translate(-1426, -950);
          box(1218, 914, 416, 72, 12, active ? P.allowBg : P.accent);
          if (active) {
            const check = out((n - activeAt) / .13);
            const first = clamp(check / .38), second = clamp((check - .38) / .62);
            line([[1264, 949], [lerp(1264, 1275, first), lerp(949, 961, first)]], P.allow, 4);
            if (second > 0) line([[1275, 961], [lerp(1275, 1294, second), lerp(961, 937, second)]], P.allow, 4);
            text('Rules active', 1446, 963, 40, P.allow, 590, 'center');
          } else text('Activate rules', 1426, 963, 40, P.paper, 590, 'center');
          c.restore(); c.restore();
        }
        if (n >= activeAt) {
          const edge = out((n - activeAt) / .22), fade = 1 - ease((n - activeAt - .23) / .24);
          c.save(); c.globalAlpha = .7 * fade;
          line([[1688, 986], [1688, lerp(986, 547, edge)]], P.allow, 4);
          c.restore();
        }
        c.restore();
      }
      // One visible administrator: submit, inspect each proposal, then activate.
      const waypoints = [
        [5.43, 1654, 790], [6.34, 1654, 790], [6.65, 1488, 647], [7.03, 1488, 647],
        [7.32, 1710, 578], [8.28, 1710, 578], [8.52, 1450, 652],
        [8.82, 1450, 738], [9.12, 1450, 824], [9.51, 1450, 824],
        [9.82, 1590, 954], [10.49, 1590, 954], [10.70, 1710, 989]
      ];
      let cx = waypoints[0][1], cy = waypoints[0][2];
      for (let i = 1; i < waypoints.length; i++) {
        const from = waypoints[i - 1], to = waypoints[i];
        if (n >= to[0]) { cx = to[1]; cy = to[2]; continue; }
        const progress = ease((n - from[0]) / (to[0] - from[0]));
        cx = lerp(from[1], to[1], progress); cy = lerp(from[2], to[2], progress); break;
      }
      const click = n < 8 ? sendAt : activateAt;
      cursor(cx, cy, 1 - Math.max(0, 1 - Math.abs(n - click) / .09) * .13);
      clickRing(1488, 647, n - sendAt);
      clickRing(1590, 954, n - activateAt);
    }
    return { renderAt };
  };
})(window);
