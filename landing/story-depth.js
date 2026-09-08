const checkpoint = document.querySelector('.checkpoint');
if (checkpoint) {
  const geometry = checkpoint.querySelector('.checkpoint-geometry');
  const resize = () => geometry?.style.setProperty('--checkpoint-scale', String(checkpoint.clientWidth / 560));
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(checkpoint);
  else window.addEventListener('resize', resize, { passive: true });
  const shield = checkpoint.querySelector('.checkpoint-shield');
  const mount = () => import('./shield.js?v=depth-1').then(({ mountShield }) => mountShield(shield)).catch(() => {});
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect(); mount();
    }, { rootMargin: '150px 0px' });
    observer.observe(checkpoint);
  } else mount();
}
