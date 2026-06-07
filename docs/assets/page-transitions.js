const transitionDuration = 180;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

window.addEventListener('pageshow', () => {
  document.body.classList.remove('is-leaving');
});

document.addEventListener('click', (event) => {
  const link = event.target.closest('a');

  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.target ||
    link.hasAttribute('download') ||
    prefersReducedMotion.matches
  ) {
    return;
  }

  const destination = new URL(link.href, window.location.href);

  if (
    destination.origin !== window.location.origin ||
    destination.href === window.location.href ||
    destination.hash
  ) {
    return;
  }

  event.preventDefault();
  document.body.classList.add('is-leaving');

  window.setTimeout(() => {
    window.location.assign(destination.href);
  }, transitionDuration);
});
