import { UIInjector } from './ui/UIInjector';

const injector = new UIInjector();
injector.init();
window.addEventListener('pagehide', () => injector.destroy(), { once: true });
