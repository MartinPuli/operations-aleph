/* Warden v12: authored product examples, painted only from the supplied clock.
 * Canonical durations: policy 4.5s, tools 3s, proof 3s.
 * No live backend, network, people, timers, or additional animation runtime.
 * The host owns the headline area above y=200 and the voice-time mapping.
 */
(function (global) {
  'use strict';
  global.createWardenWorkbenchV12 = function (canvas) {
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
    const prompt = buffer(1560, 330), hub = buffer(340, 300);
    const rulePlanes = [buffer(1560, 100), buffer(1560, 100), buffer(1560, 100)];
    const claude = buffer(640, 500), codex = buffer(640, 500);
    const privateWork = buffer(600, 220), publicWork = buffer(600, 190);
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
    function plane(ctx, image, x, y, w, h, rx = 0, ry = 0, depth = 0, rz = 0) {
      const iw = image.width, ih = image.height;
      if (Math.abs(rx) + Math.abs(ry) + Math.abs(depth) + Math.abs(rz) < .0001) {
        ctx.save(); ctx.shadowColor = '#00000035'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
        ctx.drawImage(image, x, y, w, h); ctx.restore(); return;
      }
      const focal = 1800, sinX = Math.sin(rx), cosX = Math.cos(rx), sinY = Math.sin(ry), cosY = Math.cos(ry);
      function project(u, v, z = 0) {
        const ax = (u - .5) * w, ay = (v - .5) * h;
        const bx = ax * cosY + z * sinY, bz = -ax * sinY + z * cosY;
        const by = ay * cosX - bz * sinX, zz = ay * sinX + bz * cosX + depth;
        const scale = focal / (focal - zz);
        return [x + w / 2 + (bx * Math.cos(rz) - by * Math.sin(rz)) * scale, y + h / 2 + (bx * Math.sin(rz) + by * Math.cos(rz)) * scale];
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
        const a = axis(0), b = axis(1);
        ctx.save(); ctx.beginPath();
        d.forEach((p, i) => {
          // Offset each clipping edge by a full pixel. Radial vertex expansion
          // leaves hairline seams on shallow, wide triangles during a turn.
          const prev = d[(i + 2) % 3], next = d[(i + 1) % 3];
          const u = [p[0] - prev[0], p[1] - prev[1]], v = [next[0] - p[0], next[1] - p[1]];
          const ul = Math.hypot(u[0], u[1]), vl = Math.hypot(v[0], v[1]);
          const n0 = [u[1] / ul, -u[0] / ul], n1 = [v[1] / vl, -v[0] / vl];
          const denom = Math.max(.001, 1 + n0[0] * n1[0] + n0[1] * n1[1]);
          const px = p[0] + .9 * (n0[0] + n1[0]) / denom, py = p[1] + .9 * (n0[1] + n1[1]) / denom;
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
    function kick(t, at, strength = 8) {
      const elapsed = t - at;
      return elapsed >= 0 && elapsed < .32 ? Math.sin(elapsed * 30) * Math.exp(-elapsed * 13) * strength : 0;
    }
    function ruleSwitch(ctx, progress, y = 50) {
      rect(ctx, 1433, y - 20, 89, 40, 20, progress > .02 ? P.mintBg : '#354854', progress > .02 ? '#4e826c' : '#607781');
      ctx.beginPath(); ctx.arc(mix(1454, 1500, progress), y, 14, 0, Math.PI * 2);
      ctx.fillStyle = progress > .5 ? P.mint : P.secondary; ctx.fill();
    }
    function policy(t) {
      const sendAt = .82, activateAt = 3.25, dock = between(t, .87, 1.22);
      const promptH = mix(330, 204, dock), promptY = mix(336, 232, dock);
      const q = prompt.ctx; reset(q, 1560, 330);
      rect(q, 1, 1, 1558, promptH - 2, 17, P.raised, P.edge);
      text(q, 'You', 52, mix(58, 49, dock), 30, P.secondary, 580);
      text(q, 'Help our team write client emails', 52, mix(133, 107, dock), mix(51, 44, dock), P.text, 560);
      text(q, 'without exposing confidential information.', 52, mix(203, 164, dock), mix(51, 44, dock), P.text, 560);
      if (dock < .70) button(q, t >= sendAt ? 'Sent' : 'Send', 1220, 240, 284, 66, pressAt(t, sendAt));
      c.save(); c.translate(0, kick(t, activateAt, 8));
      const enter = out(t / .22), turn = Math.sin(Math.PI * dock);
      plane(c, prompt.el, 180 + 40 * (1 - enter) + 17 * turn, promptY, 1560, 330,
        -.04 * (1 - enter), .025 * turn, 24 * turn, -.012 * turn);
      if (t >= .88 && t < 1.50) {
        const pulse = out((t - .88) / .38);
        line(c, [[960, promptY + promptH], [960, mix(promptY + promptH, 526, pulse)]], '#b9cfd8', 3);
        rect(c, 952, mix(promptY + promptH, 520, pulse), 16, 9, 4, P.text);
      }
      if (t >= 1.01) {
        text(c, 'Drafted for your team', 180, 489, 36, P.secondary, 560);
        const focus = t >= 2.05 && t < 2.92 ? Math.min(2, Math.floor((t - 2.05) / .27)) : -1;
        rules.forEach((rule, i) => {
          const born = 1.01 + i * .065;
          if (t < born) return;
          const fan = out((t - born) / .19), settle = between(t, 1.36 + i * .04, 1.76 + i * .04);
          const switched = out((t - 3.36 - i * .09) / .14), on = switched >= .99;
          const r = rulePlanes[i].ctx; reset(r, 1560, 100);
          rect(r, 1, 1, 1558, 98, 12, focus === i ? '#263f4b' : P.raised, on ? '#426d5e' : focus === i ? '#a2bac7' : P.edge);
          tag(r, rule.action, 23, 25, 188, rule.kind, 50, 30);
          text(r, rule.name, 253, 65, 44, P.text, 580);
          text(r, on ? 'Active' : 'Draft', 1399, 63, 30, on ? P.mint : P.muted, 550, 'right');
          ruleSwitch(r, switched);
          if (focus === i) rect(r, 2, 17, 4, 66, 2, '#b4ced8');
          const fanX = [-47, 0, 47][i] * fan, fanY = 557 + i * 27;
          const x = mix(180 + fanX, 180, settle), y = mix(fanY - (1 - fan) * 46, 530 + i * 118, settle);
          plane(c, rulePlanes[i].el, x, y, 1560, 100,
            -.14 * (1 - settle), [.085, 0, -.085][i] * (1 - settle), (38 + i * 15) * (1 - settle), [-.036, .004, .036][i] * (1 - settle));
        });
        if (t >= 1.84) {
          const allActive = t >= 3.68;
          text(c, allActive ? 'Policy active' : 'Drafts are not active.', 180, 967, 34, allActive ? P.mint : P.secondary, 550);
          button(c, allActive ? 'Rules active' : 'Activate rules', 1286, 914, 454, 76, pressAt(t, activateAt), allActive);
          if (t >= 3.36 && t < 3.93) {
            const latch = out((t - 3.36) / .35), fade = 1 - between(t, 3.68, 3.93);
            c.save(); c.globalAlpha = fade * .8;
            line(c, [[1752, 528], [1752, mix(528, 870, latch)]], P.mint, 4); c.restore();
          }
        }
      }
      const pointer = follow(t, [
        [0, 1730, 750], [.42, 1690, 750], [.71, 1590, 625], [.87, 1590, 625],
        [1.32, 1745, 539], [1.88, 1745, 539], [2.05, 1270, 580],
        [2.32, 1270, 698], [2.59, 1270, 816], [2.86, 1270, 816],
        [3.17, 1608, 949], [3.45, 1608, 949], [3.9, 1742, 1004], [4.5, 1742, 1004]
      ]);
      cursor(c, pointer[0], pointer[1], Math.max(pressAt(t, sendAt), pressAt(t, activateAt)));
      c.restore();
    }
    function toolSurface(target, name, role, task, connected, code = false) {
      const q = target.ctx; reset(q, 640, 500);
      rect(q, 1, 1, 638, 498, 19, P.panel, P.edge);
      text(q, role, 34, 51, 31, P.secondary, 550);
      text(q, 'Workspace', 606, 50, 25, P.muted, 510, 'right');
      line(q, [[24, 75], [616, 75]], P.edgeLow);
      text(q, name, 34, 163, name === 'Claude Code' ? 63 : 72, P.text, 590);
      text(q, task, 35, 243, 41, P.secondary, 530);
      if (code) {
        rect(q, 34, 279, 572, 84, 9, P.raised);
        text(q, 'pricing.ts', 57, 332, 33, P.text, 540);
        text(q, '+12  −4', 582, 332, 31, P.secondary, 520, 'right');
      } else {
        line(q, [[38, 301], [568, 301]], '#617785', 5);
        line(q, [[38, 330], [471, 330]], '#425c6a', 5);
      }
      line(q, [[34, 390], [606, 390]], P.edgeLow);
      if (connected) {
        check(q, 52, 445, P.mint, 24);
        text(q, 'Warden connected', 85, 458, 36, P.mint, 590);
      } else text(q, 'Connecting to your policy', 36, 458, 32, P.secondary, 530);
    }
    function tools(t) {
      const leftIn = out(t / .70), rightIn = out((t - .89) / .66);
      const leftConnected = t >= .70, rightConnected = t >= 1.55;
      const leftX = mix(-138, 120, leftIn) + kick(t, .70, 9), rightX = mix(1418, 1160, rightIn) - kick(t, 1.55, 9);
      activePolicy(c, 120, 230, 1680);
      const h = hub.ctx; reset(h, 340, 300);
      rect(h, 1, 1, 338, 298, 19, '#172a34', '#607d84');
      mark(h, 119, 40, 102, P.text);
      text(h, 'Your rules', 170, 207, 43, P.text, 580, 'center');
      tag(h, 'Active', 99, 234, 142, 'mint', 44, 28);
      plane(c, hub.el, 790, 422, 340, 300, 0, 0, 0);
      // Two physical connector tongues meet their policy sockets on the latch beat.
      const connector = (x1, x2, y, progress, connected) => {
        line(c, [[x1, y], [x2, y]], P.edge, 4);
        const x = mix(x1, x2 - 30, progress);
        rect(c, x, y - 23, 30, 46, 7, connected ? '#2f5f4e' : '#5a6c75', connected ? P.mint : '#a6bac1');
        line(c, [[x + 13, y - 8], [x + 13, y + 8]], connected ? P.mint : P.text, 3);
      };
      toolSurface(claude, 'Claude Code', 'Product', 'Client update', leftConnected);
      toolSurface(codex, 'Codex', 'Engineering', 'Pricing service', rightConnected, true);
      if (t >= .89) {
        plane(c, codex.el, rightX, 348, 640, 500, -.025 * (1 - rightIn), -.17 * (1 - rightIn), -90 * (1 - rightIn), .035 * (1 - rightIn));
      }
      plane(c, claude.el, leftX, 348, 640, 500, -.025 * (1 - leftIn), .17 * (1 - leftIn), -90 * (1 - leftIn), -.035 * (1 - leftIn));
      connector(leftX + 616, 804, 572, leftIn, leftConnected);
      if (t >= .89) connector(1116, rightX + 21, 572, rightIn, rightConnected);
      [[.70, 781], [1.55, 1137]].forEach(([at, x]) => {
        if (t < at || t > at + .26) return;
        const p = (t - at) / .26;
        c.save(); c.globalAlpha = (1 - p) * .75;
        line(c, [[x, 525 - 8 * p], [x, 619 + 8 * p]], P.mint, 3); c.restore();
      });
      // The two connected workspaces and central policy object carry the result visually.
    }
    function documentIcon(ctx, x, y, color, size = 44) {
      const w = size * .73;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * .65, y); ctx.lineTo(x + w, y + size * .25);
      ctx.lineTo(x + w, y + size); ctx.lineTo(x, y + size); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
      line(ctx, [[x + w * .65, y], [x + w * .65, y + size * .25], [x + w, y + size * .25]], color, 2.5);
    }
    function proof(t) {
      const stopped = t >= 1, publicPass = between(t, 1.22, 2.22), completed = t >= 2.30;
      activePolicy(c, 120, 230, 1680);
      // Two requests occupy separate horizontal lanes under the same policy.
      line(c, [[150, 465], [1768, 465]], '#344d59', 3);
      line(c, [[150, 832], [1768, 832]], '#344d59', 3);
      const gateX = 970 + kick(t, 1, 5);
      rect(c, gateX, 329, 57, 654, 11, '#1b303b', '#76929a');
      line(c, [[gateX + 9, 342], [gateX + 9, 970]], '#b0c4ca50', 2);
      rect(c, 1220, 389, 580, 179, 13, P.base, P.edgeLow);
      text(c, 'Model', 1253, 447, 38, P.secondary, 570);
      if (stopped) text(c, 'Client file not sent.', 1253, 511, 37, P.text, 560);
      const a = privateWork.ctx; reset(a, 600, 220);
      rect(a, 1, 1, 598, 218, 15, P.raised, stopped ? '#bd6677' : P.edge);
      documentIcon(a, 28, 29, stopped ? P.coral : P.secondary, 45);
      text(a, 'client-brief.csv', 86, 66, 44, P.text, 580);
      line(a, [[29, 92], [571, 92]], P.edgeLow);
      text(a, 'Client contact details', 29, 144, 32, P.secondary, 520);
      text(a, 'Bank account details', 29, 192, 32, P.secondary, 520);
      const arrive = between(t, .20, 1), privateX = mix(120, 370, arrive) - kick(t, 1, 15);
      plane(c, privateWork.el, privateX, 366, 600, 220, 0, -.035 * Math.sin(Math.PI * arrive), 15 * Math.sin(Math.PI * arrive), 0);
      if (stopped) {
        const p = out((t - 1) / .15);
        rect(c, 370, 608, 600, 79, 10, P.coralBg, '#8a4758');
        line(c, [[398, 635], [422, 659]], P.coral, 4); line(c, [[422, 635], [398, 659]], P.coral, 4);
        text(c, 'Blocked by your rule', 445, 660, 41, P.coral, 620);
        if (t < 1.30) {
          c.save(); c.globalAlpha = (1 - p) * .8;
          line(c, [[970, 348], [970, 607]], P.coral, 6); c.restore();
        }
      }
      const b = publicWork.ctx; reset(b, 600, 190);
      rect(b, 1, 1, 598, 188, 15, completed ? '#15372d' : P.raised, completed ? '#578b74' : P.edge);
      documentIcon(b, 27, 26, completed ? P.mint : P.secondary, 42);
      text(b, completed ? 'Public update ready' : 'public-faq.md', 86, 64, completed ? 39 : 44, P.text, 580);
      line(b, [[28, 91], [572, 91]], completed ? '#3d6555' : P.edgeLow);
      if (completed) {
        check(b, 43, 138, P.mint, 25);
        text(b, 'Allowed by your policy', 79, 152, 35, P.mint, 580);
      } else text(b, 'Summarize the public FAQ.', 29, 151, 34, P.secondary, 520);
      const publicX = mix(120, 1200, publicPass);
      if (publicPass > 0) line(c, [[145, 832], [publicX + 35, 832]], P.mint, 4);
      // The intact public request crosses the boundary; the client file stays put.
      plane(c, publicWork.el, publicX, 736, 600, 190, 0, .045 * Math.sin(Math.PI * publicPass), 25 * Math.sin(Math.PI * publicPass), -.012 * Math.sin(Math.PI * publicPass));
      if (completed) text(c, 'Public work goes through.', 1200, 991, 39, P.mint, 570);
    }
    const durations = Object.freeze({ policy: 4.5, tools: 3, proof: 3 });
    const milestones = Object.freeze({
      policy: { send: .82, firstDraft: 1.01, draftsDocked: 1.84, review: [2.05, 2.32, 2.59], activatePress: 3.25, switches: [3.36, 3.45, 3.54], active: 3.68 },
      tools: { claudeConnected: .70, codexConnected: 1.55, settled: 2.12 },
      proof: { privateBlocked: 1, publicStarts: 1.22, publicCrosses: 1.73, publicArrives: 2.22, publicComplete: 2.30 }
    });
    function renderAt(localSeconds, section) {
      if (!Object.prototype.hasOwnProperty.call(durations, section)) throw new Error('Unknown Warden workbench section: ' + section);
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
