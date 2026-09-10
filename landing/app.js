import { mountLight } from './light.js?v=white-studio-1';

// The head watchdog falls back to readable markup if this module cannot load.
window.__wardenReady = true;
// Restore enhancement if the readable fallback ran while this module was delayed.
document.documentElement.classList.add('js');
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hasIO = 'IntersectionObserver' in window;
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// A manual step cancels old playback timers without rejected promises.
function wait(ms, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve(false); return; }
    const finish = value => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      resolve(value);
    };
    const cancel = () => finish(false);
    const timer = setTimeout(() => finish(true), motion.matches ? 0 : ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

function makeTyper(elements) {
  const targets = elements.filter(Boolean);
  if (!targets.length) return null;
  const isInput = 'value' in targets[0];
  const full = isInput ? targets[0].value : targets[0].textContent;
  const write = value => targets.forEach(el => {
    if (isInput) el.value = value;
    else el.textContent = value;
  });
  return {
    finish() { write(full); },
    run(duration, signal) {
      if (motion.matches || signal?.aborted) { write(full); return Promise.resolve(); }
      return new Promise(resolve => {
        let frame;
        const start = performance.now();
        const finish = () => {
          cancelAnimationFrame(frame);
          signal?.removeEventListener('abort', finish);
          write(full); resolve();
        };
        const draw = now => {
          const progress = Math.min(1, (now - start) / duration);
          write(full.slice(0, Math.ceil(full.length * progress)));
          if (progress >= 1) finish();
          else frame = requestAnimationFrame(draw);
        };
        write('');
        signal?.addEventListener('abort', finish, { once: true });
        frame = requestAnimationFrame(draw);
      });
    }
  };
}

const zone = document.querySelector('.hero-zone');
let heroReady = false, heroFallback;
function showHeroChoices() {
  if (heroReady) return;
  heroReady = true;
  clearTimeout(heroFallback);
  zone?.classList.add('hero-ready');
  if (zone) zone.dataset.heroPhase = 'ready';
}
let light;
try { if (zone) light = mountLight(zone, {
  onVerdictSettled: showHeroChoices,
  onUnavailable: () => { if (zone.classList.contains('judged')) showHeroChoices(); }
}); }
catch (error) { zone?.classList.add('nogl'); console.warn(error.message); }
const judge = document.getElementById('judge');
if (judge && light) {
  judge.setAttribute('role', 'button');
  judge.tabIndex = 0;
  judge.setAttribute('aria-label', 'Run the next example request through Warden');
}
const heroTyper = makeTyper(judge ? [judge.querySelector('.typed')] : []);
const heroPlayback = new AbortController();
function heroVerdict(on) {
  judge?.classList.toggle('judged', on);
  zone?.classList.toggle('judged', on);
  light?.set(on);
}
if (zone && !motion.matches) {
  heroVerdict(false);
  if (zone) zone.dataset.heroPhase = 'request';
  // Secondary links must still become available if the GPU or a tab stops
  // producing frames. The primary action is never in this delayed group.
  heroFallback = setTimeout(showHeroChoices, 2500);
  (async () => {
    if (!await wait(140, heroPlayback.signal)) return;
    await heroTyper?.run(620, heroPlayback.signal);
    if (await wait(140, heroPlayback.signal)) {
      heroVerdict(true);
      if (zone && !heroReady) zone.dataset.heroPhase = 'verdict';
      if (!light && await wait(500, heroPlayback.signal)) showHeroChoices();
    }
  })();
} else { heroVerdict(true); showHeroChoices(); }

const revealables = $$('[data-reveal]');
let revealObserver;
if (motion.matches || !hasIO) revealables.forEach(el => el.classList.add('is-in'));
else {
  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: .05 });
  revealables.forEach(el => revealObserver.observe(el));
}

const chapters = $$('.chapter');
const ruleBox = document.getElementById('ruleMsg');
const sendButton = document.querySelector('[data-chapter="write"] .send');
const timings = {
  write: { type: 420, first: 620, second: 880 },
  hit: { type: 340, first: 520, second: 760 },
  log: { type: 0, first: 520, second: 720 },
  spend: { type: 360, first: 560, second: 800 }
};
const states = new Map(chapters.map(chapter => [chapter, {
  controller: null, started: false,
  typer: makeTyper(chapter.dataset.chapter === 'write' ? [ruleBox] : $$('.pt', chapter))
}]));
let autoplay;
// Observe the action itself, so a composer or caption above the fold cannot
// finish the proposal animation before the visitor reaches the rules.
const playbackTargets = new Map(chapters.map(chapter => [chapter,
  (chapter.dataset.chapter === 'write' && chapter.querySelector('.ruleset'))
    || chapter.querySelector('.panel') || chapter
]));
const targetChapters = new Map([...playbackTargets].map(([chapter, target]) => [target, chapter]));
const unobserveChapter = chapter => autoplay?.unobserve(playbackTargets.get(chapter));
function canStartChapter(entry, viewportHeight = window.innerHeight) {
  const panelHeight = entry.boundingClientRect.height;
  const rootHeight = entry.rootBounds?.height || viewportHeight * .9;
  const fraction = entry.target?.classList.contains('ruleset') ? .5 : .3;
  const required = Math.min(panelHeight * fraction, rootHeight * .35);
  return entry.isIntersecting && panelHeight > 0 && rootHeight > 0
    && entry.intersectionRect.height >= required;
}

// Once someone selects or focuses a real tool control, retain their choice.
// Programmatic radio changes do not emit change events.
const tools = document.querySelector('[data-chapter="hit"] .tools');
let toolsOwnedByVisitor = false;
for (const event of ['pointerdown', 'keydown', 'change', 'focusin']) {
  tools?.addEventListener(event, () => { toolsOwnedByVisitor = true; });
}
async function cycleTools(signal) {
  for (const [delay, id] of [[350, 'tool-cx'], [550, 'tool-oc'], [550, 'tool-cc']]) {
    if (!await wait(delay, signal) || toolsOwnedByVisitor || motion.matches) return;
    const radio = document.getElementById(id);
    if (radio) radio.checked = true;
  }
}
function pulse(element, className, duration, signal) {
  if (!element || motion.matches || signal?.aborted) return;
  element.classList.add(className);
  wait(duration, signal).then(() => element.classList.remove(className));
}
function stop(chapter) {
  const state = states.get(chapter);
  state.controller?.abort(); state.typer?.finish(); state.controller = null;
  chapter.dataset.storyPlaying = 'false';
  if (chapter.dataset.chapter === 'write') sendButton?.classList.remove('pressed');
  if (chapter.dataset.chapter === 'hit') ruleBox?.classList.remove('hit');
}
function setStep(chapter, step, { effects = false, signal } = {}) {
  if (step > 0) states.get(chapter).typer?.finish();
  chapter.dataset.step = String(step);
  $$('[data-story-step]', chapter).forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.storyStep) === step));
  });
  $$('.say', chapter).forEach((statement, index) => {
    statement.setAttribute('aria-hidden', String(index !== step));
  });
  // Manual steps may happen before the reveal observer fires.
  $$('[data-reveal]', chapter).forEach(el => el.classList.add('is-in'));
  if (!effects || motion.matches) return;
  if (chapter.dataset.chapter === 'write' && step === 1) pulse(sendButton, 'pressed', 140, signal);
  if (chapter.dataset.chapter === 'hit' && step === 1) pulse(ruleBox, 'hit', 850, signal);
  if (chapter.dataset.chapter === 'hit' && step === 2 && !toolsOwnedByVisitor) cycleTools(signal);
}
function complete(chapter) {
  stop(chapter); states.get(chapter).started = true; unobserveChapter(chapter);
  setStep(chapter, 2);
}
async function play(chapter) {
  stop(chapter);
  const state = states.get(chapter);
  state.started = true; unobserveChapter(chapter);
  if (motion.matches || !hasIO) { complete(chapter); return; }
  const controller = new AbortController();
  const { signal } = controller;
  state.controller = controller; chapter.dataset.storyPlaying = 'true';
  const timing = timings[chapter.dataset.chapter] || timings.log;
  setStep(chapter, 0);
  // Neither the fixed beat nor the prompt can be overtaken by the verdict.
  await Promise.all([state.typer?.run(timing.type, signal), wait(timing.first, signal)]);
  if (signal.aborted) return;
  setStep(chapter, 1, { effects: true, signal });
  if (!await wait(timing.second, signal)) return;
  setStep(chapter, 2, { effects: true, signal });
  // Original CSS chips and tool examples resolve, then hold indefinitely.
  if (await wait(900, signal)) chapter.dataset.storyPlaying = 'false';
}
for (const chapter of chapters) {
  chapter.dataset.step = '0';
  $$('[data-story-step]', chapter).forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.storyStep === '0'));
    button.addEventListener('click', () => {
      const step = Number(button.dataset.storyStep);
      if (![0, 1, 2].includes(step)) return;
      stop(chapter); states.get(chapter).started = true; unobserveChapter(chapter);
      setStep(chapter, step);
    });
  });
  $$('[data-story-replay]', chapter).forEach(button => {
    // Focus stays on the stable replay button throughout playback.
    button.addEventListener('click', () => play(chapter));
  });
}
if (motion.matches || !hasIO) chapters.forEach(complete);
else {
  autoplay = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!canStartChapter(entry)) continue;
      const chapter = targetChapters.get(entry.target);
      if (chapter && !states.get(chapter).started) play(chapter);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: [0, .05, .15, .3, .5] });
  playbackTargets.forEach(target => autoplay.observe(target));
}
motion.addEventListener('change', () => {
  if (!motion.matches) return;
  heroPlayback.abort(); heroTyper?.finish(); heroVerdict(true);
  showHeroChoices();
  revealObserver?.disconnect(); revealables.forEach(el => el.classList.add('is-in'));
  chapters.forEach(complete);
});

// Links retain their native fallback and modified-click behavior. The movie
// is loaded only after an ordinary click opens a supported modal.
const filmDialog = document.getElementById('film-dialog');
const filmVideo = document.getElementById('launch-video');
let filmTrigger;
$$('[data-open-film]').forEach(link => link.addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!filmDialog?.showModal || !filmVideo) return;
  event.preventDefault(); filmTrigger = link;
  const source = filmVideo.querySelector('source');
  if (source && !source.getAttribute('src')) {
    source.src = source.dataset.src || link.href; filmVideo.load();
  }
  filmDialog.showModal();
  if (filmVideo.ended) filmVideo.currentTime = 0;
  filmVideo.play().catch(() => {});
}));
document.getElementById('close-film')?.addEventListener('click', () => filmDialog?.close());
filmDialog?.addEventListener('close', () => { filmVideo?.pause(); filmTrigger?.focus(); });
filmDialog?.addEventListener('click', event => {
  if (event.target !== filmDialog) return;
  const rect = filmDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) filmDialog.close();
});

const LATEST = 'https://github.com/Wardenlabs/warden/releases/latest';
const MAC = { label: 'Download for macOS', href: `${LATEST}/download/Warden-arm64.dmg`, other: 'Also on macOS' };
const WIN = { label: 'Download for Windows', href: `${LATEST}/download/Warden-Setup.exe`, other: 'Also on Windows' };
const alt = document.querySelector('.hero .cta .alt');
const onWindows = /Windows|Win64|Win32/i.test(navigator.userAgent || '');
if (onWindows) {
  $$('[data-platform-download]').forEach(primary => {
    primary.classList.add('on-windows');
    const label = primary.querySelector('.txt');
    if (label) label.textContent = WIN.label;
    primary.href = WIN.href;
  });
  if (alt) { alt.textContent = MAC.other; alt.href = MAC.href; }
}
const footerDownloads = document.querySelector('.foot .dl');
const windowsDownload = footerDownloads?.querySelector(`a[href="${WIN.href}"]`);
if (onWindows && windowsDownload) footerDownloads.prepend(windowsDownload);

// Lazy footer WebGL remains independent: failure leaves the static mark.
const shieldStage = document.querySelector('.shield-stage');
const lowCapability = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
if (shieldStage && !motion.matches && !lowCapability) {
  const mount = () => import('./shield.js?v=white-studio-1')
    .then(({ mountShield }) => mountShield(shieldStage)).catch(() => {});
  if (hasIO) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect(); mount();
    }, { rootMargin: '300px 0px' });
    observer.observe(shieldStage);
  } else mount();
}
