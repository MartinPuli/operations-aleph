/* Warden v11: authored product examples, painted only from the supplied clock.
 * Canonical durations: policy 7s, tools 5.8s, proof 4.5s.
 * No live backend, network, people, timers, or additional animation runtime.
 * The host owns the headline area above y=200 and the voice-time mapping.
 */
(function (global) {
  'use strict';
  global.createWardenWorkbenchV11 = function (canvas) {
    const W = 1920, H = 1080;
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('The Warden workbench needs a 2D canvas.');
    const P = {
      ink: '#081119', base: '#0d1b24', panel: '#13242f', raised: '#1b303b',
      edge: '#3d5663', edgeLow: '#2a404c', text: '#f0ede4', secondary: '#bdcbd1',
      muted: '#93aab5', mint: '#a2edce', mintBg: '#183b32',
      coral: '#ff94a2', coralBg: '#402530', amber: '#ebc478', amberBg: '#3b3223'
    };
    const clamp = x => Math.max(0, Math.min(1, x));
    const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
    const out = x => 1 - Math.pow(1 - clamp(x), 4);
    const between = (t, a, b) => ease((t - a) / (b - a));
    const mix = (a, b, p) => a + (b - a) * p;
    function buffer(w, h) {
      const el = document.createElement('canvas'); el.width = w; el.height = h;
      return { el, ctx: el.getContext('2d') };
    }
    const prompt = buffer(1560, 330), drafts = buffer(1560, 528);
    const rulePlanes = [buffer(1464, 86), buffer(1464, 86), buffer(1464, 86)];
    const claude = buffer(1100, 680), codex = buffer(1100, 680);
    const privateWork = buffer(800, 644), publicWork = buffer(800, 644);
    const symbol = Array.isArray(global.WARDEN_SYMBOL_PATHS)
      ? global.WARDEN_SYMBOL_PATHS.map(value => new Path2D(value)) : [];
    function reset(ctx, w, h) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
      ctx.clearRect(0, 0, w, h); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }
    function rect(ctx, x, y, w, h, radius, fill, stroke, lw = 1.5) {
      ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), radius);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    }
    function text(ctx, copy, x, y, size, color = P.text, weight = 540, align = 'left') {
      ctx.font = weight + ' ' + size + 'px WardenDisplay, Inter, sans-serif';
      ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
      ctx.fillText(copy, x, y);
    }
    function line(ctx, pts, color, width = 2) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    }
    function check(ctx, x, y, color, size = 20, progress = 1) {
      const a = clamp(progress / .36), b = clamp((progress - .36) / .64);
      line(ctx, [[x - size * .5, y], [mix(x - size * .5, x - size * .1, a), mix(y, y + size * .38, a)]], color, Math.max(2, size * .12));
      if (b > 0) line(ctx, [[x - size * .1, y + size * .38], [mix(x - size * .1, x + size * .6, b), mix(y + size * .38, y - size * .44, b)]], color, Math.max(2, size * .12));
    }
    function mark(ctx, x, y, size, color = P.mint) {
      if (!symbol.length) { check(ctx, x + size / 2, y + size / 2, color, size * .6); return; }
      ctx.save(); ctx.translate(x, y); ctx.scale(size / 411.56, size / 411.56);
      ctx.translate(-329.92, -465.98); ctx.fillStyle = color;
      symbol.forEach(path => ctx.fill(path, 'evenodd')); ctx.restore();
    }
    function tag(ctx, copy, x, y, w, kind = 'muted', height = 44, size = 25) {
      const color = kind === 'mint' ? P.mint : kind === 'coral' ? P.coral : kind === 'amber' ? P.amber : P.secondary;
      const bg = kind === 'mint' ? P.mintBg : kind === 'coral' ? P.coralBg : kind === 'amber' ? P.amberBg : '#243a45';
      rect(ctx, x, y, w, height, 7, bg);
      text(ctx, copy, x + w / 2, y + height / 2 + size * .35, size, color, 590, 'center');
    }
    function button(ctx, copy, x, y, w, h, pressed = 0, active = false) {
      ctx.save(); ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(1 - pressed * .035, 1 - pressed * .035); ctx.translate(-w / 2, -h / 2);
      rect(ctx, 0, 4, w, h, 10, '#061b14');
      rect(ctx, 0, 0, w, h, 10, active ? P.mintBg : P.mint, active ? '#4d7d68' : '#c2f5df');
      if (active) check(ctx, 37, h / 2, P.mint, 22);
      text(ctx, copy, w / 2 + (active ? 12 : 0), h / 2 + 13, 36, active ? P.mint : '#10291e', 640, 'center');
      ctx.restore();
    }
    function cursor(ctx, x, y, press = 0) {
      ctx.save(); ctx.translate(x, y); ctx.scale(1 - press * .13, 1 - press * .13);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, 35); ctx.lineTo(11, 26);
      ctx.lineTo(19, 43); ctx.lineTo(27, 39); ctx.lineTo(18, 23); ctx.lineTo(32, 20); ctx.closePath();
      ctx.fillStyle = P.text; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    }
    function pressAt(t, at) { return Math.max(0, 1 - Math.abs(t - at) / .10); }
    function follow(t, points) {
      for (let i = 1; i < points.length; i++) {
        if (t <= points[i][0]) {
          const a = points[i - 1], b = points[i], p = between(t, a[0], b[0]);
          return [mix(a[1], b[1], p), mix(a[2], b[2], p)];
        }
      }
      return points[points.length - 1].slice(1);
    }
    function panel(ctx, w, h, title, right, accent = P.mint) {
      rect(ctx, 1, 1, w - 2, h - 2, 18, P.panel, P.edge);
      line(ctx, [[20, 72], [w - 20, 72]], P.edgeLow);
      if (title === 'Warden') { mark(ctx, 28, 21, 31, accent); text(ctx, title, 75, 50, 30, P.text, 600); }
      else text(ctx, title, 32, 50, 32, P.text, 600);
      if (right) text(ctx, right, w - 32, 49, 25, P.muted, 510, 'right');
    }
    // Project a textured surface from actual X/Y rotations and depth. At rest use
    // a direct draw, so text has no mesh seams or resampling after it settles.
    function plane(ctx, image, x, y, w, h, rx = 0, ry = 0, depth = 0) {
      const iw = image.width, ih = image.height;
      if (Math.abs(rx) + Math.abs(ry) + Math.abs(depth) < .0001) {
        ctx.save(); ctx.shadowColor = '#00000035'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
        ctx.drawImage(image, x, y, w, h); ctx.restore(); return;
      }
      const focal = 1800, sinX = Math.sin(rx), cosX = Math.cos(rx), sinY = Math.sin(ry), cosY = Math.cos(ry);
      function project(u, v, z = 0) {
        const ax = (u - .5) * w, ay = (v - .5) * h;
        const bx = ax * cosY + z * sinY, bz = -ax * sinY + z * cosY;
        const by = ay * cosX - bz * sinX, zz = ay * sinX + bz * cosX + depth;
        const scale = focal / (focal - zz);
        return [x + w / 2 + bx * scale, y + h / 2 + by * scale];
      }
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(p => project(p[0], p[1]));
      const rear = [[0, 0], [1, 0], [1, 1], [0, 1]].map(p => project(p[0], p[1], -9));
      ctx.save(); ctx.fillStyle = '#050c12'; ctx.beginPath();
      rear.forEach((p, i) => i ? ctx.lineTo(p[0], p[1] + 7) : ctx.moveTo(p[0], p[1] + 7));
      ctx.closePath(); ctx.fill(); ctx.restore();
      function triangle(s, d) {
        const den = s[0][0] * (s[1][1] - s[2][1]) + s[1][0] * (s[2][1] - s[0][1]) + s[2][0] * (s[0][1] - s[1][1]);
        const axis = q => [
          (d[0][q] * (s[1][1] - s[2][1]) + d[1][q] * (s[2][1] - s[0][1]) + d[2][q] * (s[0][1] - s[1][1])) / den,
          (d[0][q] * (s[2][0] - s[1][0]) + d[1][q] * (s[0][0] - s[2][0]) + d[2][q] * (s[1][0] - s[0][0])) / den,
          (d[0][q] * (s[1][0] * s[2][1] - s[2][0] * s[1][1]) + d[1][q] * (s[2][0] * s[0][1] - s[0][0] * s[2][1]) + d[2][q] * (s[0][0] * s[1][1] - s[1][0] * s[0][1])) / den
        ];
        const a = axis(0), b = axis(1), center = [(d[0][0] + d[1][0] + d[2][0]) / 3, (d[0][1] + d[1][1] + d[2][1]) / 3];
        ctx.save(); ctx.beginPath();
        d.forEach((p, i) => {
          const dx = p[0] - center[0], dy = p[1] - center[1], len = Math.hypot(dx, dy);
          const px = p[0] + dx / len * .35, py = p[1] + dy / len * .35;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        });
        ctx.closePath(); ctx.clip(); ctx.transform(a[0], b[0], a[1], b[1], a[2], b[2]);
        ctx.drawImage(image, 0, 0); ctx.restore();
      }
      const cols = 6, rows = 4;
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const uv = [[col / cols, row / rows], [(col + 1) / cols, row / rows], [(col + 1) / cols, (row + 1) / rows], [col / cols, (row + 1) / rows]];
        const src = uv.map(p => [p[0] * iw, p[1] * ih]), dst = uv.map(p => project(p[0], p[1]));
        triangle([src[0], src[1], src[2]], [dst[0], dst[1], dst[2]]);
        triangle([src[0], src[2], src[3]], [dst[0], dst[2], dst[3]]);
      }
      ctx.save(); ctx.beginPath(); corners.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath(); ctx.strokeStyle = '#9fb7bf45'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.clip();
      const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
      sheen.addColorStop(0, '#d0f4e000'); sheen.addColorStop(.46, '#d0f4e008');
      sheen.addColorStop(.53, '#d0f4e025'); sheen.addColorStop(1, '#d0f4e000');
      ctx.globalAlpha = Math.min(.8, (Math.abs(rx) + Math.abs(ry)) * 3);
      ctx.fillStyle = sheen; ctx.fillRect(x - 100, y - 100, w + 200, h + 200); ctx.restore();
    }
    function background() {
      reset(c, W, H); c.fillStyle = P.ink; c.fillRect(0, 0, W, H);
      // A grounded application stage. No animated background ornament.
      line(c, [[96, 1030], [1824, 1030]], '#203441', 1);
    }
    function activePolicy(ctx, x, y, w, progress = 1) {
      rect(ctx, x, y, w, 68, 11, P.base, '#36554b');
      mark(ctx, x + 21, y + 16, 35);
      text(ctx, 'Client information', x + 73, y + 44, 31, P.text, 570);
      if (progress >= 1) {
        check(ctx, x + w - 233, y + 34, P.mint, 19);
        text(ctx, 'Policy active', x + w - 207, y + 45, 28, P.mint, 590);
      } else {
        line(ctx, [[x + 10, y + 67], [x + 10 + (w - 20) * progress, y + 67]], P.mint, 3);
      }
    }
    const rules = [
      { name: 'Client contact details', kind: 'coral', action: 'BLOCK' },
      { name: 'Bank account details', kind: 'coral', action: 'BLOCK' },
      { name: 'Non-public pricing', kind: 'amber', action: 'REVIEW' }
    ];
    function policy(t) {
      const dock = between(t, 1.82, 2.17), start = out(t / .35), active = t >= 5.52;
      const promptH = mix(330, 204, dock), promptY = mix(336, 232, dock);
      const q = prompt.ctx; reset(q, 1560, 330);
      rect(q, 1, 1, 1558, promptH - 2, 18, P.raised, P.edge);
      text(q, 'You', 52, mix(58, 49, dock), 30, P.secondary, 580);
      const fontsize = mix(51, 44, dock);
      text(q, 'Help our team write client emails', 52, mix(133, 107, dock), fontsize, P.text, 560);
      text(q, 'without exposing confidential information.', 52, mix(203, 164, dock), fontsize, P.text, 560);
      if (dock < .85) button(q, t >= 1.65 ? 'Sent' : 'Send', 1220, 240, 284, 66, pressAt(t, 1.65));
      plane(c, prompt.el, 180, promptY + 22 * (1 - start), 1560, 330, -.06 * (1 - start), .025 * (1 - start), -36 * (1 - start));
      if (t >= 1.79 && t < 2.5) {
        const route = out((t - 1.79) / .43);
        line(c, [[960, promptY + promptH], [960, mix(promptY + promptH, 460, route)]], P.mint, 3);
        rect(c, 955, mix(promptY + promptH, 455, route), 10, 8, 3, P.mint);
      }
      if (t >= 2.05) {
        const d = drafts.ctx; reset(d, 1560, 528); panel(d, 1560, 528, 'Warden', active ? 'Policy active' : 'Review before activating');
        text(d, 'Drafts from your instruction', 48, 119, 34, P.text, 590);
        const reviewIndex = t >= 3.4 && t < 4.65 ? Math.min(2, Math.floor((t - 3.4) / .42)) : -1;
        rules.forEach((rule, i) => {
          const arrival = 2.15 + i * .19, r = rulePlanes[i].ctx;
          if (t < arrival) return;
          reset(r, 1464, 86);
          rect(r, 1, 1, 1462, 84, 10, reviewIndex === i ? '#203a46' : P.raised, reviewIndex === i ? '#91b7c6' : P.edgeLow);
          tag(r, rule.action, 18, 18, 178, rule.kind, 49, 28);
          text(r, rule.name, 232, 56, 39, P.text, 570);
          if (active) {
            check(r, 1308, 43, P.mint, 19);
            text(r, 'Active', 1428, 54, 29, P.mint, 590, 'right');
          } else text(r, 'Draft', 1428, 54, 29, P.muted, 520, 'right');
          const arrive = out((t - arrival) / .43);
          plane(d, rulePlanes[i].el, 48, 143 + i * 93 - (1 - arrive) * (26 + i * 10), 1464, 86, -.18 * (1 - arrive), .016 * (1 - arrive), -75 * (1 - arrive));
        });
        line(d, [[48, 443], [1512, 443]], P.edgeLow);
        text(d, 'Applies to your team', 48, 492, 29, P.secondary, 510);
        button(d, active ? 'Rules active' : 'Activate rules', 1114, 457, 398, 58, pressAt(t, 5.35), active);
        if (active && t < 6.08) {
          const acknowledgment = Math.sin(Math.PI * clamp((t - 5.52) / .56));
          d.save(); d.globalAlpha = acknowledgment * .8;
          rect(d, 1.5, 1.5, 1557, 525, 18, null, P.mint, 3); d.restore();
        }
        const land = out((t - 2.05) / .35);
        plane(c, drafts.el, 180, 460 + 34 * (1 - land), 1560, 528, -.06 * (1 - land), -.025 * (1 - land), -45 * (1 - land));
      }
      const pointer = follow(t, [
        [0, 1700, 730], [1.10, 1640, 693], [1.49, 1588, 631], [1.72, 1588, 631],
        [2.22, 1738, 598], [3.05, 1738, 598], [3.40, 1400, 651],
        [3.82, 1400, 744], [4.24, 1400, 837], [4.69, 1400, 837],
        [5.15, 1615, 950], [5.62, 1615, 950], [6.1, 1738, 1004], [7, 1738, 1004]
      ]);
      cursor(c, pointer[0], pointer[1], Math.max(pressAt(t, 1.65), pressAt(t, 5.35)));
    }
    function drawTool(target, name, team, connected, variant, workProgress, w, h) {
      // Render at the current window size; resize the layout rather than the type.
      w = Math.round(w); h = Math.round(h);
      if (target.el.width !== w) target.el.width = w;
      if (target.el.height !== h) target.el.height = h;
      const q = target.ctx, spacious = clamp((w - 816) / 734);
      reset(q, w, h); panel(q, w, h, name, team);
      rect(q, 28, 94, w - 56, 57, 9, P.base, P.edgeLow);
      mark(q, 46, 107, 29);
      text(q, connected ? 'Warden connected' : 'Connect to Warden', 92, 132, 30, connected ? P.mint : P.secondary, 590);
      if (connected) check(q, w - 65, 122, P.mint, 22);
      text(q, variant === 'code' ? 'Pricing service' : 'Client update', 44, 212, mix(44, 52, spacious), P.text, 600);
      const path = variant === 'code' ? 'workspace / pricing' : 'workspace / communications';
      tag(q, path, 44, 236, Math.min(w - 88, variant === 'code' ? 410 : 556), 'muted', 39, 24);
      const inputY = mix(296, 300, spacious), inputH = mix(115, 154, spacious);
      rect(q, 44, inputY, w - 88, inputH, 12, P.raised, P.edgeLow);
      text(q, 'You', 68, inputY + 35, 26, P.muted, 550);
      text(q, variant === 'code' ? 'Update the pricing service.' : 'Draft the customer update.', 68, inputY + 85, mix(34, 43, spacious), P.text, 540);
      const outputY = mix(432, 480, spacious), outputH = mix(94, 123, spacious);
      if (workProgress > 0) {
        const enter = out(workProgress);
        rect(q, 44, outputY, w - 88, outputH, 11, '#102a25', '#315748');
        check(q, 78, outputY + 31, P.mint, 21, enter);
        text(q, variant === 'code' ? 'Changes ready to review' : 'Draft ready to review', 107, outputY + 42, mix(31, 35, spacious), P.mint, 580);
        text(q, variant === 'code' ? 'pricing.ts  +12  −4' : 'Client update · ready in your workspace', 68, outputY + 78, mix(25, 28, spacious), P.secondary, 480);
      } else {
        line(q, [[68, outputY + 31], [w - 94, outputY + 31]], P.edgeLow, 8);
        line(q, [[68, outputY + 64], [w - 210, outputY + 64]], P.edgeLow, 8);
      }
    }
    function tools(t) {
      const firstConnection = t >= .55, secondConnection = t >= 2.15;
      const split = between(t, 1.56, 2.14), ready = between(t, 4.12, 4.50);
      activePolicy(c, 115, 226, 1690, t >= .35 ? 1 : out(t / .35));
      const firstX = mix(185, 115, split), firstY = mix(322, 333, split);
      const firstW = mix(1550, 816, split), firstH = mix(630, 552, split);
      drawTool(claude, 'Claude Code', 'Product', firstConnection, 'copy', t >= .92 ? out((t - .92) / .34) : 0, firstW, firstH);
      drawTool(codex, 'Codex', 'Engineering', secondConnection, 'code', t >= 2.55 ? out((t - 2.55) / .34) : 0, 816, 552);
      if (t >= 1.56) {
        plane(c, codex.el, mix(1480, 989, split), mix(393, 333, split), 816, 552, -.045 * (1 - split), -.16 * (1 - split), -120 * (1 - split));
      }
      plane(c, claude.el, firstX, firstY, firstW, firstH, 0, .07 * Math.sin(Math.PI * split), 15 * Math.sin(Math.PI * split));
      if (t >= 3.40) {
        const enter = out((t - 3.40) / .32), y = 920 + 28 * (1 - enter);
        rect(c, 115, y, 1690, 86, 12, P.panel, P.edge);
        text(c, 'Operations', 146, y + 55, 36, P.text, 580);
        line(c, [[385, y + 22], [385, y + 64]], P.edgeLow);
        text(c, 'Compatible tools', 418, y + 55, 36, P.secondary, 540);
        if (ready > .98) {
          check(c, 1548, y + 43, P.mint, 22);
          text(c, 'Connected', 1580, y + 55, 31, P.mint, 590);
        } else {
          const p = out((t - 3.55) / .65);
          line(c, [[1325, y + 43], [1325 + 380 * p, y + 43]], P.mint, 3);
        }
      }
      // Each latch gets a bounded edge response on the surface it connects.
      [[.55, firstX, firstY, firstW, firstH], [2.15, 989, 333, 816, 552]].forEach(([at, x, y, w, h]) => {
        if (t >= at && t < at + .4) {
          c.save(); c.globalAlpha = .7 * Math.sin(Math.PI * (t - at) / .4);
          rect(c, x, y, w, h, 15, null, P.mint, 3); c.restore();
        }
      });
    }
    function documentIcon(ctx, x, y, color, size = 44) {
      const w = size * .73;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * .65, y); ctx.lineTo(x + w, y + size * .25);
      ctx.lineTo(x + w, y + size); ctx.lineTo(x, y + size); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
      line(ctx, [[x + w * .65, y], [x + w * .65, y + size * .25], [x + w, y + size * .25]], color, 2.5);
    }
    function proof(t) {
      const blocked = t >= 1.45, publicReady = t >= 3.15;
      const a = privateWork.ctx, b = publicWork.ctx;
      reset(a, 800, 644); reset(b, 800, 644);
      panel(a, 800, 644, 'Client file', 'Product', P.coral);
      panel(b, 800, 644, 'Public update', 'Operations', P.mint);
      text(a, 'Include these client details.', 35, 143, 36, P.text, 550);
      const arrive = out((t - .10) / .65);
      const bumpTime = Math.max(0, t - 1.45), bump = blocked ? Math.exp(-bumpTime * 14) * Math.sin(bumpTime * 30) * 8 : 0;
      const attachmentX = mix(23, 35, arrive) - bump;
      rect(a, attachmentX, 183, 730, 220, 13, P.raised, blocked ? '#9e5364' : P.edge);
      documentIcon(a, attachmentX + 27, 209, blocked ? P.coral : P.secondary, 42);
      text(a, 'client-brief.csv', attachmentX + 86, 243, 38, P.text, 570);
      line(a, [[attachmentX + 26, 272], [attachmentX + 704, 272]], P.edgeLow);
      text(a, 'Client contact details', attachmentX + 27, 319, 32, P.secondary, 520);
      text(a, 'Bank account details', attachmentX + 27, 365, 32, P.secondary, 520);
      if (blocked) {
        rect(a, 35, 436, 730, 152, 12, P.coralBg, '#8c4555');
        line(a, [[65, 470], [85, 490]], P.coral, 4); line(a, [[85, 470], [65, 490]], P.coral, 4);
        text(a, 'Blocked by your rule', 105, 493, 39, P.coral, 630);
        text(a, 'Stopped before the model.', 61, 550, 31, P.secondary, 510);
      } else {
        text(a, 'Checking your policy', 36, 484, 34, P.secondary, 540);
        const p = out((t - .4) / 1.05);
        line(a, [[37, 519], [37 + 695 * p, 519]], P.mint, 4);
      }
      text(b, 'Summarize our public FAQ.', 35, 143, 36, P.text, 550);
      rect(b, 35, 183, 730, 112, 13, P.raised, P.edge);
      documentIcon(b, 62, 213, P.secondary, 39);
      text(b, 'public-faq.md', 121, 250, 38, P.text, 570);
      if (t >= 1.8) {
        const reveal = out((t - 1.8) / .3);
        rect(b, 35, 331 + 20 * (1 - reveal), 730, 171, 12, '#132e29', '#3d6756');
        text(b, 'Your update', 61, 379 + 20 * (1 - reveal), 28, P.mint, 580);
        text(b, 'A clear public summary,', 61, 430 + 20 * (1 - reveal), 35, P.text, 560);
        text(b, 'ready for your team.', 61, 476 + 20 * (1 - reveal), 35, P.text, 560);
      }
      if (publicReady) {
        check(b, 55, 557, P.mint, 24, out((t - 3.15) / .2));
        text(b, 'Public work goes through', 86, 570, 36, P.mint, 590);
      }
      activePolicy(c, 115, 226, 1690);
      const enter = out(t / .38);
      plane(c, privateWork.el, 115, 329 + 16 * (1 - enter), 800, 644, -.045 * (1 - enter), .025 * (1 - enter), -30 * (1 - enter));
      plane(c, publicWork.el, 1005, 329 + 30 * (1 - enter), 800, 644, -.055 * (1 - enter), -.025 * (1 - enter), -40 * (1 - enter));
      if (blocked && t < 1.85) {
        c.save(); c.globalAlpha = Math.sin(Math.PI * (t - 1.45) / .4) * .75;
        rect(c, 115, 329, 800, 644, 18, null, P.coral, 3); c.restore();
      }
    }
    const durations = Object.freeze({ policy: 7, tools: 5.8, proof: 4.5 });
    const milestones = Object.freeze({
      policy: { send: 1.65, firstDraft: 2.15, lastDraftSettles: 2.96, review: [3.4, 3.82, 4.24], activatePress: 5.35, active: 5.52 },
      tools: { claudeConnected: .55, codexConnected: 2.15, operations: 3.4, operationsConnected: 4.5 },
      proof: { privateBlocked: 1.45, publicOutput: 1.8, publicComplete: 3.15 }
    });
    function renderAt(localSeconds, section) {
      if (!(section in durations)) throw new Error('Unknown Warden workbench section: ' + section);
      const t = Math.max(0, Math.min(durations[section], Number(localSeconds) || 0));
      background();
      if (section === 'policy') policy(t);
      else if (section === 'tools') tools(t);
      else proof(t);
      return { section, time: t };
    }
    return { renderAt, durations, milestones };
  };
})(window);
