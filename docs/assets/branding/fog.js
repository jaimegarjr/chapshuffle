(function initializeChapShuffleFog() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches || !window.VANTA?.FOG) {
    return;
  }

  window.VANTA.FOG({
    el: '#vanta-bg',
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    highlightColor: 0xff4444,
    midtoneColor: 0xcc0000,
    lowlightColor: 0x660000,
    baseColor: 0x0f0f0f,
    blurFactor: 0.9,
    speed: 0.8,
    zoom: 0.2,
  });
})();
