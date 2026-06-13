const views = new Map(
  [...document.querySelectorAll('[data-view]')].map((view) => [view.dataset.view, view]),
);
const titles = {
  home: 'Chap Shuffle',
  privacy: 'Privacy Policy — Chap Shuffle',
};

let currentView = getRoute();
let isTransitioning = false;
let pendingView = null;

function getRoute() {
  return window.location.hash === '#privacy' ? 'privacy' : 'home';
}

function showInitialView() {
  views.forEach((view, name) => {
    view.hidden = name !== currentView;
  });
  document.title = titles[currentView];
}

async function transitionTo(nextView) {
  if (nextView === currentView || !views.has(nextView)) {
    return;
  }

  if (isTransitioning) {
    pendingView = nextView;
    return;
  }

  const outgoing = views.get(currentView);
  const incoming = views.get(nextView);
  const direction = nextView === 'privacy' ? 1 : -1;

  isTransitioning = true;

  await outgoing.animate(
    [
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: `translateX(${-24 * direction}px)` },
    ],
    { duration: 180, easing: 'ease-in', fill: 'forwards' },
  ).finished;

  outgoing.hidden = true;
  outgoing.getAnimations().forEach((animation) => animation.cancel());
  incoming.hidden = false;
  window.scrollTo({ top: 0, behavior: 'auto' });

  await incoming.animate(
    [
      { opacity: 0, transform: `translateX(${24 * direction}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ],
    { duration: 260, easing: 'ease-out' },
  ).finished;

  currentView = nextView;
  document.title = titles[currentView];
  isTransitioning = false;

  if (currentView === 'privacy') {
    document.querySelector('#privacy-heading').focus({ preventScroll: true });
  }

  if (pendingView && pendingView !== currentView) {
    const queuedView = pendingView;
    pendingView = null;
    transitionTo(queuedView);
  } else {
    pendingView = null;
  }
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-route]');

  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.target ||
    link.hasAttribute('download')
  ) {
    return;
  }

  event.preventDefault();
  const nextView = link.dataset.route;
  const nextUrl =
    nextView === 'privacy'
      ? `${window.location.pathname}${window.location.search}#privacy`
      : `${window.location.pathname}${window.location.search}`;

  window.history.pushState({ view: nextView }, '', nextUrl);
  transitionTo(nextView);
});

window.addEventListener('popstate', () => {
  transitionTo(getRoute());
});

showInitialView();
