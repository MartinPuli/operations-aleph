/* Camera-led editorial handoffs. Based on the installed zoom-through primitive:
   simultaneous picture handoff, a shared focal plane, and a fully settled landing.
   Buffers are painted from absolute time, never copied from a previous frame. */
(function (global) {
  'use strict';
  global.createWardenTransitionDirector = function ({ canvas, renderPicture }) {
    const W = 1920, H = 1080, c = canvas.getContext('2d');
    const buffer = () => { const b = document.createElement('canvas'); b.width = W; b.height = H; return b; };
    const a = buffer(), b = buffer(), ac = a.getContext('2d'), bc = b.getContext('2d');
    const clamp = n => Math.max(0, Math.min(1, n));
    const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
    const mix = (x, y, p) => x + (y - x) * p;
    const impulse = n => { n = clamp(n); return n === 1 ? 1 : 1 - Math.pow(2, -9 * n); };
    const transitions = [
      { cut: 2, start: 1.46, end: 2.25, kind: 'attachment', label: 'The sent attachment opens into exposed client data', anchor: [578, 691, 910, 113] },
      { cut: 4, start: 3.81, end: 4.19, kind: 'track', label: 'Continue into company secrets' },
      { cut: 5, start: 4.86, end: 5.14, kind: 'match', label: 'Same confidential document surface' },
      { cut: 6, start: 5.80, end: 6.14, kind: 'boundary', label: 'The outgoing data route becomes a policy boundary', anchor: [1268, 589] },
      { cut: 12, start: 11.30, end: 12.30, kind: 'pullback', label: 'The active rule reaches the team', anchor: [960, 650] },
      { cut: 14, start: 13.72, end: 14.28, kind: 'screen', label: 'Enter the employee’s AI workspace', anchor: [360, 650] },
      { cut: 18, start: 17.79, end: 18.21, kind: 'track', label: 'Move to a separate review request' },
      { cut: 20, start: 19.80, end: 20.20, kind: 'track', label: 'A separate public-information request' },
      { cut: 22, start: 21.72, end: 22.35, kind: 'ports', label: 'One request opens into three connected workspaces' },
      { cut: 28, start: 27.48, end: 28, kind: 'resolve', label: 'The official shield opens the 3D brand stage' }
    ];
    function draw(image, { scale = 1, x = 0, y = 0, alpha = 1, blur = 0, cx = W / 2, cy = H / 2 } = {}) {
      c.save(); c.globalAlpha = alpha; c.filter = blur > .05 ? `blur(${blur.toFixed(2)}px)` : 'none';
      c.translate(cx + x, cy + y); c.scale(scale, scale); c.translate(-cx, -cy);
      c.drawImage(image, 0, 0); c.restore();
    }
    function reveal(p, fn) {
      c.save(); c.beginPath(); c.rect(0, 0, W * p, H); c.clip(); fn(); c.restore();
    }
    function roundedWindow(image, x, y, w, h, r, { alpha = 1, edge = null, edgeAlpha = 0 } = {}) {
      if (w <= .01 || h <= .01 || alpha <= 0) return;
      c.save(); c.globalAlpha = alpha;
      c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); c.clip();
      c.drawImage(image, 0, 0); c.restore();
      if (edge && edgeAlpha > 0) {
        c.save(); c.strokeStyle = edge; c.globalAlpha = edgeAlpha; c.lineWidth = 2;
        c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); c.stroke(); c.restore();
      }
    }
    function routedLine(points, color, alpha, width = 3) {
      c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width;
      c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
      points.forEach((point, i) => i ? c.lineTo(...point) : c.moveTo(...point));
      c.stroke(); c.restore();
    }
    function frame(t) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none';
      const tr = transitions.find(v => t >= v.start && t < v.end);
      if (!tr) { renderPicture(t, c); return null; }
      const raw = clamp((t - tr.start) / (tr.end - tr.start)), p = smooth(raw);
      if(tr.kind==='resolve'){
        renderPicture(tr.start-.0001,ac);
        renderPicture(28,bc,{endOutputTime:global.wardenPace.toLegacyOutput(t)});
      }else{
        renderPicture(Math.min(t, tr.cut - .0001), ac);
        renderPicture(Math.max(t, tr.cut + .0001), bc);
      }
      c.fillStyle = '#f1ede3'; c.fillRect(0, 0, W, H);
      if (tr.kind === 'attachment') {
        // Commit to the sent file, then accelerate through it into the data world.
        // The camera and aperture use the same attachment coordinates throughout.
        const [ax, ay, aw, ah] = tr.anchor, fx = ax + aw / 2, fy = ay + ah / 2;
        const push = smooth(raw / .40), scale = 1 + .22 * push;
        draw(a, { scale, cx: fx, cy: fy });
        const open = impulse((raw - .25) / .55);
        const x = mix(fx + (ax - fx) * scale, 0, open);
        const y = mix(fy + (ay - fy) * scale, 0, open);
        const w = mix(aw * scale, W, open), h = mix(ah * scale, H, open);
        if (raw >= .25) roundedWindow(b, x, y, w, h, 17 * (1 - open));
        // A short energized rim traces the source attachment and resolves with it.
        const energy = smooth(raw / .08) * (1 - smooth((raw - .65) / .15));
        if (energy > 0) {
          c.save(); c.globalAlpha = energy; c.strokeStyle = '#f47583'; c.lineWidth = 3;
          c.beginPath(); c.roundRect(x, y, w, h, 17 * (1 - open)); c.stroke();
          const route = clamp(raw / .25), px = mix(x + w * .70, x + w, route);
          if (raw < .25) {
            c.fillStyle = '#f47583'; c.beginPath(); c.roundRect(px - 11, y + h - 5, 22, 10, 4); c.fill();
          }
          c.restore();
        }
      } else if (tr.kind === 'boundary') {
        // A physical policy gate latches across the outgoing route, then releases
        // into the administration scene. The source swaps only while fully covered.
        const latch = .42, open = impulse((raw - latch) / .48);
        const close = smooth(raw / latch), coverage = raw < latch ? close : 1 - open;
        draw(raw < latch ? a : b);
        const seam = tr.anchor[0], leftX = -seam * (1 - coverage);
        const rightX = seam + (W - seam) * (1 - coverage);
        const gatePanel = (x, w, rightEdge) => {
          if (w <= 0 || coverage <= 0) return;
          c.save();
          const gradient = c.createLinearGradient(x, 0, x + w, 0);
          gradient.addColorStop(0, rightEdge ? '#101522' : '#1f2a42');
          gradient.addColorStop(1, rightEdge ? '#1f2a42' : '#101522');
          c.fillStyle = gradient; c.fillRect(x, 0, w, H);
          const edgeX = rightEdge ? x + w : x;
          c.fillStyle = '#7b6bac'; c.fillRect(edgeX - (rightEdge ? 3 : 0), 0, 3, H);
          c.restore();
        };
        gatePanel(leftX, seam, true); gatePanel(rightX, W - seam, false);
        // The latch is tied to the data-route height, not a full-frame flash.
        const hit = smooth((raw - .31) / .11) * (1 - smooth((raw - .43) / .12));
        if (hit > 0) {
          c.save(); c.globalAlpha = hit; c.fillStyle = '#c9baff';
          c.beginPath(); c.roundRect(seam - 7, tr.anchor[1] - 32, 14, 64, 5); c.fill(); c.restore();
        }
      } else if (tr.kind === 'ports') {
        // Connect first, resolve second: brief drawn paths lead into complete people.
        // The public shield is gone before any face appears; columns never slit faces.
        const base = smooth(raw / .20), mint = [156, 233, 198], ivory = [241, 237, 227];
        c.fillStyle = `rgb(${mint.map((value, i) => Math.round(mix(value, ivory[i], base))).join(',')})`;
        c.fillRect(0, 0, W, H); draw(a, { alpha: 1 - smooth(raw / .18) });
        const route = impulse((raw - .12) / .42), routeEnd = mix(360, 1560, route);
        const routeAlpha = smooth(raw / .15) * (1 - smooth((raw - .65) / .12));
        routedLine([[360, 803], [routeEnd, 803]], '#667c92', routeAlpha * .75, 3);
        const columns = [[0, 660, 360], [660, 1260, 960], [1260, W, 1560]];
        columns.forEach(([left, right, center], i) => {
          const trigger = .30 + i * .13, resolve = clamp((raw - trigger) / .12);
          const opacity = smooth((raw - trigger) / .055);
          const outline = smooth((raw - .13 - i * .06) / .08) * (1 - opacity);
          if (outline > 0) {
            c.save(); c.globalAlpha = outline;
            c.strokeStyle = ['#8778bd', '#426c65', '#b78042'][i]; c.lineWidth = 4;
            const connector = smooth((raw - .13 - i * .06) / .13);
            c.beginPath(); c.moveTo(center, 803); c.lineTo(center, mix(803, 748, connector)); c.stroke();
            c.beginPath(); c.roundRect(center - 151, 570, 302, 162, 13); c.stroke();
            c.beginPath(); c.moveTo(center - 120, 749); c.lineTo(center + 120, 749); c.stroke();
            c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(center, 803, 6, 0, Math.PI * 2); c.fill();
            c.restore();
          }
          if (opacity > 0) {
            c.save(); c.globalAlpha = opacity;
            c.beginPath(); c.rect(left, 0, right - left, H); c.clip();
            c.filter = resolve < 1 ? `blur(${(2.4 * (1 - resolve)).toFixed(2)}px)` : 'none';
            c.drawImage(b, 0, 0); c.restore();
          }
        });
      } else if (tr.kind === 'track') {
        // The two panels share direction and velocity; no empty interstitial frame.
        draw(a, { x: -W * p }); draw(b, { x: W * (1 - p) });
      } else if (tr.kind === 'match') {
        // Turn over complete documents inside the same registered surface.
        // Never splice two different sentences across a horizontal wipe.
        draw(a); c.save(); c.beginPath(); c.roundRect(298, 319, 916, 544, 24); c.clip();
        c.fillStyle = '#faf8f2'; c.fillRect(298, 319, 916, 544);
        c.drawImage(a, 298, 319, 916, 544, 298, 319 - 544 * p, 916, 544);
        c.drawImage(b, 298, 319, 916, 544, 298, 319 + 544 * (1 - p), 916, 544);
        c.restore();
        if (p >= .5) c.drawImage(b, 0, 900, W, 180, 0, 900, W, 180);
      } else if (tr.kind === 'surface') {
        draw(a, { scale: 1 + .045 * p, x: -64 * p, blur: 2 * Math.sin(Math.PI * p) });
        reveal(p, () => draw(b, { scale: 1 + .035 * (1 - p), x: 38 * (1 - p) }));
      } else if (tr.kind === 'pullback') {
        draw(b);
        const scale = mix(1, 278 / W, p), centerY = mix(H / 2, tr.anchor[1], p);
        const x = tr.anchor[0] - W * scale / 2, y = centerY - H * scale / 2;
        c.save(); c.globalAlpha = 1 - smooth((raw - .80) / .20);
        c.beginPath(); c.roundRect(x, y, W * scale, H * scale, 12 * p); c.clip();
        c.drawImage(a, x, y, W * scale, H * scale); c.restore();
      } else if (tr.kind === 'screen') {
        // Camera travels into the actual first employee’s laptop, then resolves in 3D.
        const travel = smooth(raw / .70), scale = mix(1, W / 278, travel);
        const cx = mix(W / 2, tr.anchor[0], travel), cy = mix(H / 2, tr.anchor[1], travel);
        c.save(); c.translate(W / 2, H / 2); c.scale(scale, scale); c.translate(-cx, -cy);
        c.drawImage(a, 0, 0); c.restore();
        if (raw >= .44) {
          // The next world occupies the laptop display itself, then expands past
          // its bezel. An opaque portal avoids double-exposed people and objects.
          const open = smooth((raw - .44) / .56);
          const sx = W / 2 + (221 - cx) * scale, sy = H / 2 + (581 - cy) * scale;
          const x = mix(sx, 0, open), y = mix(sy, 0, open);
          const w = mix(278 * scale, W, open), h = mix(137 * scale, H, open);
          c.save(); c.beginPath(); c.roundRect(x, y, w, h, 8 * (1 - open)); c.clip();
          draw(b); c.restore();
        }
      } else if (tr.kind === 'resolve') {
        draw(a);
        // Scale the actual outer shield contour into a single brand aperture.
        const outer=new Path2D(global.WARDEN_SYMBOL_PATHS[0].split(/z/i)[0]+'z');
        const expand=smooth(raw),scale=.002+14*expand;
        const shape=new Path2D();
        shape.addPath(outer,new DOMMatrix([scale,0,0,scale,960-535.7*scale,450-671.7*scale]));
        c.save();c.clip(shape);draw(b);c.restore();
        if(raw<.80){c.save();c.strokeStyle='#9ce9c6';c.globalAlpha=(1-smooth((raw-.55)/.25))*.7;c.lineWidth=2;c.stroke(shape);c.restore();}
      }
      return { ...tr, progress: raw, intactHeadlines: ['attachment', 'boundary', 'ports'].includes(tr.kind) };
    }
    return { renderAt: frame, transitions };
  };
})(window);
