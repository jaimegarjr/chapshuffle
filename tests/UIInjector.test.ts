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
  const controls = doc.createElement('div');
  controls.className = 'ytp-right-controls';
  doc.body.appendChild(controls);
  return controls;
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

// ── tests ──────────────────────────────────────────────────────────────────

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
});

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

    const panel = document.getElementById('chapshuffule-queue')!;
    expect(panel).not.toBeNull();
    expect(panel.style.display).toBe('none');
    injector.destroy();
  });

  test('clicking the toggle button shows the panel', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);

    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    const btn = document.getElementById('chapshuffule-btn') as HTMLButtonElement;
    btn.click();

    expect(document.getElementById('chapshuffule-queue')!.style.display).toBe('block');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    injector.destroy();
  });

  test('clicking the toggle button a second time hides the panel', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);

    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    const btn = document.getElementById('chapshuffule-btn') as HTMLButtonElement;
    btn.click(); // open
    btn.click(); // close

    expect(document.getElementById('chapshuffule-queue')!.style.display).toBe('none');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    injector.destroy();
  });
});

describe('UIInjector — queue panel content', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('renders a row for each chapter with title and timestamp', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);

    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    const panel = document.getElementById('chapshuffule-queue')!;
    const rows = panel.querySelectorAll('.chapshuffule-item');
    expect(rows.length).toBe(5);
    rows.forEach((row) => {
      expect(row.querySelector('.chapshuffule-title')).not.toBeNull();
      expect(row.querySelector('.chapshuffule-time')).not.toBeNull();
    });

    injector.destroy();
  });

  test('panel has a Reshuffle button', async () => {
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
});

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
