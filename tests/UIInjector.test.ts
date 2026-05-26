/**
 * @jest-environment jsdom
 */
import { UIInjector } from '../src/ui/UIInjector';

// ── chrome mock ────────────────────────────────────────────────────────────

function buildChromeMock(initialStore: Record<string, unknown> = {}) {
  const store = { ...initialStore };
  return {
    runtime: { lastError: null as { message: string } | null },
    storage: {
      sync: {
        get: (keys: string[], cb: (r: Record<string, unknown>) => void) => {
          const result: Record<string, unknown> = {};
          for (const k of keys) if (k in store) result[k] = store[k];
          cb(result);
        },
        set: (items: Record<string, unknown>, cb: () => void) => {
          Object.assign(store, items);
          cb();
        },
        _store: store,
      },
    },
  };
}

beforeEach(() => {
  (global as unknown as Record<string, unknown>).chrome = buildChromeMock();
  document.body.innerHTML = '';
});
afterEach(() => {
  delete (global as unknown as Record<string, unknown>).chrome;
});

// ── DOM helpers ────────────────────────────────────────────────────────────

function addChapterItems(doc: Document, count: number): void {
  for (let i = 0; i < count; i++) {
    const item = doc.createElement('ytd-macro-markers-list-item-renderer');
    const ts = doc.createElement('span');
    ts.className = 'time-string';
    ts.textContent = `${i}:00`;
    const title = doc.createElement('h4');
    title.className = 'yt-simple-endpoint';
    title.textContent = `Chapter ${i + 1}`;
    item.appendChild(ts);
    item.appendChild(title);
    doc.body.appendChild(item);
  }
}

function addPlayerControls(doc: Document): Element {
  const el = doc.createElement('div');
  el.className = 'ytp-right-controls';
  doc.body.appendChild(el);
  return el;
}

function addVideoElement(doc: Document): HTMLVideoElement {
  const video = doc.createElement('video');
  doc.body.appendChild(video);
  return video;
}

async function flushAll(): Promise<void> {
  jest.runAllTimers();
  await Promise.resolve();
}

// ── injection guard ────────────────────────────────────────────────────────

describe('UIInjector — injection guard', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('does NOT inject button when fewer than 5 chapters', async () => {
    addPlayerControls(document);
    addChapterItems(document, 4);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffule-btn')).toBeNull();
    injector.destroy();
  });

  test('injects toggle button when 5+ chapters are present', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffule-btn')).not.toBeNull();
    injector.destroy();
  });

  test('calling inject-equivalent twice does NOT duplicate items', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    // Simulate a second poll tick firing before clearInterval takes effect.
    await flushAll();
    const rows = document.querySelectorAll('.chapshuffule-item');
    expect(rows.length).toBe(5);
    injector.destroy();
  });
});

// ── panel visibility ───────────────────────────────────────────────────────

describe('UIInjector — queue panel visibility', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('queue panel starts hidden', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffule-queue')!.style.display).toBe('none');
    injector.destroy();
  });

  test('clicking the toggle button shows the panel', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    (document.getElementById('chapshuffule-btn') as HTMLButtonElement).click();
    expect(document.getElementById('chapshuffule-queue')!.style.display).toBe('block');
    injector.destroy();
  });

  test('clicking toggle button twice hides the panel again', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    const btn = document.getElementById('chapshuffule-btn') as HTMLButtonElement;
    btn.click();
    btn.click();
    expect(document.getElementById('chapshuffule-queue')!.style.display).toBe('none');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    injector.destroy();
  });
});

// ── queue content ──────────────────────────────────────────────────────────

describe('UIInjector — queue content', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('renders exactly one row per chapter', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.querySelectorAll('.chapshuffule-item').length).toBe(5);
    injector.destroy();
  });

  test('panel has a Reshuffle button in the header', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffule-reshuffle')).not.toBeNull();
    injector.destroy();
  });

  test('global toggle overlay is NOT injected into the page', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffule-toggle')).toBeNull();
    injector.destroy();
  });

  test('queue item count does not change after reshuffle', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    (document.getElementById('chapshuffule-reshuffle') as HTMLButtonElement).click();
    expect(document.querySelectorAll('.chapshuffule-item').length).toBe(5);
    injector.destroy();
  });
});

// ── cleanup ────────────────────────────────────────────────────────────────

describe('UIInjector — cleanup', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('destroy() removes all injected elements', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    injector.destroy();
    expect(document.getElementById('chapshuffule-btn')).toBeNull();
    expect(document.getElementById('chapshuffule-queue')).toBeNull();
  });
});
