/*
 * The light.
 *
 * This is the whole of it. Nothing else on the page imports from here and
 * nothing here reaches outside `.hero-zone`, so this file is the seam: swap
 * it and the rest of the landing does not notice.
 *
 * One hairline below the hero's call to action — the gate — drawn on a
 * canvas so it can be a light rather than a border: a crisp line that
 * emits a little into the dark above it. A mint signal converges while the
 * request arrives. A blocked verdict strikes the centre, sends one coral
 * crest out along the line, and settles. app.js decides when; this file draws.
 *
 * The cursor is the one other thing it answers to: passing over the line
 * brightens it a little where the pointer is, and the glow follows. Nothing
 * else on the page reacts to the mouse.
 *
 * One pass, no framebuffers. The colours are read from :root — `--bg`,
 * `--gate`, `--block` — so the line is the same coral as the verdict chip
 * and the canvas floor is exactly the page's ground. Nothing literal here.
 */

const VS = `#version 300 es
in vec2 p; out vec2 v;
void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

const FS = `#version 300 es
precision highp float; in vec2 v; out vec4 o;
uniform vec2 R; uniform float T, Y0, S, GLOW, FRONT, SIGNAL, IMPACT, HOVER, HX, VERT, LIT, BPOS, BW; uniform vec3 BASE, WARM, CORAL;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
/* smooth 1-D value noise, for the shimmer that runs along the line */
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(hash(vec2(i, 0.)), hash(vec2(i + 1., 0.)), f); }
void main(){
  vec2 fb = vec2(v.x, 1. - v.y) * R;
  // The only difference between the gate and the spine: which way the line
  // runs. Swapping the axes here means everything below — the two-lobe core,
  // the emission, the glare, the rolloff — is the same code drawing both.
  bool vert = VERT > .5;
  vec2 px = vert ? fb.yx : fb;
  vec2 RR = vert ? R.yx : R;
  float dy = px.y - Y0;
  float a  = abs(dy);
  float xs = (px.x - .5 * RR.x) / (.5 * RR.x);           // -1 at one end, +1 at the other
  float xn = abs(xs);                                    // 0 at the centre, 1 at either end
  // The line has to dissolve before it reaches the frame. Held to the edge it
  // reads as a border; released early it reads as something emitting. The gate
  // is short and releases early; the spine holds almost to its ends — released
  // at .86 the halo outlived the line, and light with no line to come from
  // reads as a smudge.
  float xf = vert ? pow(1. - smoothstep(.93, 1.04, xn), 1.1)
                  : pow(1. - smoothstep(.30, 1.02, xn), 1.35);
  // How far along the run the light has reached. 1 for the gate, which is
  // never partly lit.
  float along = xs * .5 + .5;
  float lit = vert ? 1. - smoothstep(LIT, LIT + .07, along) : 1.;
  float br = 1. + .03 * sin(T * .5);                    // it breathes, barely
  // How much of the verdict this pixel of the line has taken. In the gate the
  // front runs outward from the centre; on the spine the verdict does not
  // spread, it sits at the stage where the refusal happens.
  float k = vert ? exp(-pow((along - BPOS) / BW, 2.))
                 : GLOW * (1. - smoothstep(FRONT - .12, FRONT + .02, xn));
  // and the front itself carries a crest, so the verdict reads as something
  // travelling rather than a wipe passing over
  float crest = vert ? 0. : GLOW * exp(-pow((xn - FRONT) / .037, 2.));
  // Two short packets converge on the decision point once per request. Their
  // phase comes from set(false), so the signal belongs to the typed request.
  float envelope = sin(clamp(SIGNAL, 0., 1.) * 3.14159265);
  float incoming = vert ? 0. : (1. - GLOW) * envelope
    * exp(-pow((xn - (1. - SIGNAL) * .84) / .038, 2.));
  float impact = vert ? 0. : IMPACT * exp(-pow(xs / .115, 2.));
  // a little more light under the cursor: a soft bump along the line, nothing that moves the line
  float h = HOVER * exp(-pow((px.x - HX) / (.085 * RR.x), 2.));

  // Fine variation gives the emitter texture. There is no repeating sweep;
  // the arrival and verdict are the only autonomous gestures.
  float shim = n1(px.x / (.09 * RR.x) + T * .07) * .65 + n1(px.x / (.031 * RR.x) - T * .11) * .35;
  shim = 1. + (shim - .5) * .22 * (1. - .6 * GLOW);

  // The hairline, in two lobes. One exponential is a gradient; a core and a
  // shoulder are a light, because that is roughly the shape of a real one.
  float w = S * (1. + .6 * h);
  float line = (exp(-a / w) * 1.55 + exp(-a / (w * 3.4)) * .28)
             * (mix(1., .86, k) + .4 * h) * xf * br * shim;
  // The emission into the dark: near and far. The gate throws more above the
  // line than below because it sits under the call to action; a vertical line
  // has no up, so it throws the near-and-far pair evenly to both sides.
  float up = exp(dy / (.045 * RR.y)) * .030 + exp(dy / (.20 * RR.y)) * .009;
  float dn = exp(-dy / (.014 * RR.y)) * .012 + exp(-dy / (.05 * RR.y)) * .005;
  float sym = exp(-a / (.045 * RR.y)) * .030 + exp(-a / (.20 * RR.y)) * .009;
  float glow = (vert ? sym : (dy < 0. ? up : dn)) * xf * br;
  glow *= (1. + 1.65 * k) * (1. + 1.1 * h);
  // On the spine the emission takes the end-fade and the scroll front once
  // more than the line does, so the halo always dies before its source.
  glow *= vert ? xf * lit : 1.;
  line *= 1. + .92 * crest + .65 * incoming + .75 * impact;
  glow *= 1. + 1.2 * crest + .36 * incoming;
  // Stronger near light, confined to a few CSS pixels around the wire.
  // The surrounding hero stays dark and its text remains the focal point.
  glow += exp(-a / (S * 13.)) * (.045 * incoming + .075 * impact) * xf;

  // Glare. A bright point on a line throws its spike across the line, not
  // along it — along is where the line already is. Raised to a power so it
  // narrows: left broad it reads as haze over the line rather than glare off it.
  float hotx = pow(crest, 3.) * 1.05 + pow(h, 3.) * .6 + incoming * .28 + impact * .85;
  float glare = hotx * exp(-a / (S * 26.)) * .095;

  vec3 col = BASE + mix(WARM, CORAL, k) * (line + glow + glare) * lit;
  // Highlight rolloff. The core is brighter than the display can show, and a
  // hard clip costs the line its roundness. Rolling off instead lets the centre
  // desaturate toward white on its own, the way an overexposed emitter does,
  // and leaves --bg untouched: at the floor this curve is the identity.
  col = col * (1. + col * .25) / (1. + col);
  col = pow(col, vec3(1. / 2.2));
  col += (hash(gl_FragCoord.xy + fract(T) * 91.) - .5) * (2. / 255.);                                   // dither: no banding
  col += (hash(gl_FragCoord.xy * 1.37 + fract(T * .7) * 53.) - .5) * .012 * (1. - clamp(line, 0., 1.)); // grain, barely
  o = vec4(col, 1.); }`;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* a CSS hex colour → linear RGB, which is what the shader adds in */
function linear(hex) {
  const h = hex.trim().replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => Math.pow(parseInt(n.slice(i, i + 2), 16) / 255, 2.2));
}

/**
 * @param host    the element the canvas fills
 * @param opts    { vertical } — false draws the gate across the hero, true
 *                draws the spine down §how. Everything else is shared.
 */
export function mountLight(host, opts = {}) {
  if (!host) return null;
  const vertical = !!opts.vertical;
  const canvas = host.querySelector('canvas.scene');
  const gate = host.querySelector('.gate');
  if (!canvas || !gate) return null;

  let gl;
  try { gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' }); }
  catch { host.classList.add('nogl'); return null; }
  if (!gl) { host.classList.add('nogl'); return null; }

  const css = getComputedStyle(document.documentElement);
  const tone = (name) => linear(css.getPropertyValue(name));

  const mk = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error(message);
    }
    return sh;
  };
  const prog = gl.createProgram();
  const shaders = [];
  try {
    shaders.push(mk(gl.VERTEX_SHADER, VS));
    shaders.push(mk(gl.FRAGMENT_SHADER, FS));
    shaders.forEach(shader => gl.attachShader(prog, shader));
    gl.bindAttribLocation(prog, 0, 'p');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch {
    shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(prog);
    host.classList.add('nogl'); return null;
  }
  shaders.forEach(shader => gl.deleteShader(shader));

  const u = {};
  for (const n of ['R', 'Y0', 'S', 'T', 'GLOW', 'FRONT', 'SIGNAL', 'IMPACT', 'HOVER', 'HX', 'VERT', 'LIT', 'BPOS', 'BW', 'BASE', 'WARM', 'CORAL']) u[n] = gl.getUniformLocation(prog, n);

  const vao = gl.createVertexArray(), buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.useProgram(prog);
  gl.uniform3fv(u.BASE, tone('--bg'));
  gl.uniform3fv(u.WARM, tone('--gate'));
  gl.uniform3fv(u.CORAL, tone('--block'));

  const state = {
    W: 0, H: 0, S: 1, y0: 0,
    t0: performance.now(),
    visible: true, raf: 0, previous: 0, stopped: false,
    requestAt: performance.now(), verdictAt: reduced ? performance.now() - 1000 : null,
    glow: reduced ? 1 : 0, want: reduced ? 1 : 0, front: reduced ? 1.3 : 0,
    // the pointer: where it is along the line (device px), and how near the line it is (0..1, eased)
    hx: 0, hxWant: 0, hover: 0, hoverWant: 0,
    // spine only: how far the light has run, and where the refusal sits
    lit: reduced ? 1 : 0, litWant: reduced ? 1 : 0, bpos: .5, bw: .10,
  };

  const resize = () => {
    // The canvas's own box, not the host's: in the hero the canvas runs past
    // the section's bottom edge so the glow can die off the section instead
    // of on it, and the buffer has to cover what the box covers.
    const cr = canvas.getBoundingClientRect(), gr = gate.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = Math.round(cr.width * dpr), H = Math.round(cr.height * dpr);
    if (!W || !H) return;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    state.W = W; state.H = H; state.S = dpr;
    // The line is drawn where the layout put the anchor — across it for the
    // gate, down it for the spine. Y0 is measured on the axis the line crosses,
    // which the shader has already swapped by the time it reads it.
    state.y0 = vertical
      ? (gr.left - cr.left + gr.width / 2) * dpr
      : (gr.top - cr.top + gr.height / 2) * dpr;
  };

  // Within this many CSS px of the line, the cursor counts as "on" it.
  const REACH = 72;
  const pointerMove = (e) => {
    if (reduced) return;
    const cr = canvas.getBoundingClientRect();
    state.hxWant = (e.clientX - cr.left) * state.S;
    const dy = Math.abs((e.clientY - cr.top) * state.S - state.y0) / state.S;
    state.hoverWant = dy < REACH ? 1 - dy / REACH * .5 : 0;
    if (state.hoverWant || state.hover > .002) loop();
  };
  const pointerLeave = () => { state.hoverWant = 0; loop(); };
  if (!vertical) host.addEventListener('pointermove', pointerMove, { passive: true });
  if (!vertical) host.addEventListener('pointerleave', pointerLeave, { passive: true });

  const frame = (now) => {
    const t = reduced ? 0 : (now - state.t0) / 1000;
    const dt = state.previous ? Math.min(.05, (now - state.previous) / 1000) : 1 / 60;
    state.previous = now;
    const damp = speed => 1 - Math.exp(-speed * dt);
    const requestAge = Math.max(0, (now - state.requestAt) / 1000);
    const verdictAge = state.verdictAt === null ? 10 : Math.max(0, (now - state.verdictAt) / 1000);
    // the bump follows the cursor with a little lag, and fades rather than snaps
    if (state.hover < .01) state.hx = state.hxWant; else state.hx += (state.hxWant - state.hx) * damp(12);
    state.hover += (state.hoverWant - state.hover) * damp(state.hoverWant > state.hover ? 10 : 7);
    // in quickly, out slowly
    state.glow += (state.want - state.glow) * damp(state.want > state.glow ? 20 : 8);
    // the front runs out once the verdict lands, and only resets after the colour has faded
    if (state.want) {
      const p = Math.min(1, verdictAge / .44);
      state.front = 1.3 * p * p * (3 - 2 * p);
    }
    else if (state.glow < .02) state.front = 0;
    if (reduced) { state.glow = state.want; state.front = state.want ? 1.3 : 0; }
    gl.viewport(0, 0, state.W, state.H);
    gl.uniform2f(u.R, state.W, state.H);
    gl.uniform1f(u.Y0, state.y0); gl.uniform1f(u.S, state.S);
    gl.uniform1f(u.T, t); gl.uniform1f(u.GLOW, state.glow); gl.uniform1f(u.FRONT, state.front);
    gl.uniform1f(u.SIGNAL, reduced || vertical ? 1 : Math.min(1, requestAge / .92));
    gl.uniform1f(u.IMPACT, reduced || vertical || !state.want ? 0 : Math.sin(Math.PI * Math.min(1, verdictAge / .32)));
    gl.uniform1f(u.HOVER, reduced || vertical ? 0 : state.hover); gl.uniform1f(u.HX, state.hx);
    gl.uniform1f(u.VERT, vertical ? 1 : 0);
    // Eased, so a fast scroll does not make the light snap down the page.
    state.lit += (state.litWant - state.lit) * damp(12);
    if (reduced) state.lit = state.litWant;
    gl.uniform1f(u.LIT, vertical ? state.lit : 1);
    gl.uniform1f(u.BPOS, state.bpos); gl.uniform1f(u.BW, state.bw);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const stop = () => {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0; state.previous = 0;
  };

  const moving = now => {
    const arrival = !vertical && !state.want && now - state.requestAt < 1000;
    const verdict = !vertical && state.want && state.verdictAt !== null && now - state.verdictAt < 500;
    return arrival || verdict || Math.abs(state.want - state.glow) > .001
      || Math.abs(state.litWant - state.lit) > .001
      || Math.abs(state.hoverWant - state.hover) > .002
      || (state.hover > .01 && Math.abs(state.hxWant - state.hx) > .2);
  };

  const loop = () => {
    if (state.raf || state.stopped || !state.visible || document.hidden) return;
    const tick = (now) => {
      state.raf = 0;
      if (!state.visible || document.hidden || state.stopped) { state.previous = 0; return; }
      frame(now);
      if (!reduced && moving(now)) state.raf = requestAnimationFrame(tick);
      else state.previous = 0;
    };
    state.raf = requestAnimationFrame(tick);
  };

  // Redraw, not just resize: setting canvas.width clears it, and under
  // reduced motion nothing is coming to draw the next frame. Without the
  // loop() here the gate is wiped the first time the layout settles.
  const resized = () => { resize(); loop(); };
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resized) : null;
  if (resizeObserver) resizeObserver.observe(host);
  else window.addEventListener('resize', resized, { passive: true });
  const intersectionObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    state.visible = entries[0].isIntersecting;
    if (state.visible) loop();
    else stop();
  }, { threshold: .02 }) : null;
  intersectionObserver?.observe(host);

  const visibilityChanged = () => { if (document.hidden) stop(); else loop(); };
  const contextLost = () => {
    state.stopped = true; stop(); host.classList.add('nogl');
  };
  document.addEventListener('visibilitychange', visibilityChanged);
  canvas.addEventListener('webglcontextlost', contextLost);

  resize();
  loop();

  return {
    /* gate: true while the prompt on screen is blocked */
    set(blocked) {
      const now = performance.now();
      if (blocked && !state.want) { state.verdictAt = now; state.front = 0; }
      if (!blocked) { state.requestAt = now; state.verdictAt = null; }
      state.want = blocked ? 1 : 0;
      loop();
    },
    /* spine: how far down the run the light has reached, 0..1 */
    lightTo(v) {
      state.litWant = Math.min(1, Math.max(0, v));
      loop();
    },
    /* spine: where along the run the refusal sits, 0..1 */
    blockAt(v) { state.bpos = Math.min(1, Math.max(0, v)); loop(); },
    destroy() {
      state.stopped = true; stop();
      resizeObserver?.disconnect(); intersectionObserver?.disconnect();
      window.removeEventListener('resize', resized);
      document.removeEventListener('visibilitychange', visibilityChanged);
      canvas.removeEventListener('webglcontextlost', contextLost);
      host.removeEventListener('pointermove', pointerMove);
      host.removeEventListener('pointerleave', pointerLeave);
      gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(prog);
    },
  };
}
