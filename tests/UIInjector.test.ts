/**
 * @jest-environment jsdom
 */
import { UIInjector } from '../src/ui/UIInjector';

// ── chrome mock ────────────────────────────────────────────────────────────

function buildChromeMock(initialStore: Record<string, unknown> = {}) {
  const store = { ...initialStore };
  return {
    runtime: {
      lastError: null as { message: string } | null,
      sendMessage: () => {},
    },
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
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
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
    expect(document.getElementById('chapshuffle-btn')).toBeNull();
    injector.destroy();
  });

  test('injects toggle button when 5+ chapters are present', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffle-btn')).not.toBeNull();
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
    const rows = document.querySelectorAll('.chapshuffle-item');
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
    expect(document.getElementById('chapshuffle-queue')!.style.display).toBe('none');
    injector.destroy();
  });

  test('clicking the toggle button shows the panel', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();
    expect(document.getElementById('chapshuffle-queue')!.style.display).toBe('block');
    injector.destroy();
  });

  test('opening the panel positions it over the video', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    const video = addVideoElement(document);
    video.getBoundingClientRect = jest.fn(() => ({
      x: 100,
      y: 50,
      top: 50,
      right: 900,
      bottom: 550,
      left: 100,
      width: 800,
      height: 500,
      toJSON: () => ({}),
    } as DOMRect));

    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();

    const panel = document.getElementById('chapshuffle-queue') as HTMLDivElement;
    expect(panel.style.top).toBe('88px');
    expect(panel.style.left).toBe('576px');
    expect(panel.style.bottom).toBe('auto');
    expect(panel.style.right).toBe('auto');
    injector.destroy();
  });

  test('clicking toggle button twice hides the panel again', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    const btn = document.getElementById('chapshuffle-btn') as HTMLButtonElement;
    btn.click();
    btn.click();
    expect(document.getElementById('chapshuffle-queue')!.style.display).toBe('none');
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
    expect(document.querySelectorAll('.chapshuffle-item').length).toBe(5);
    injector.destroy();
  });

  test('panel has a Reshuffle button in the header', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffle-reshuffle')).not.toBeNull();
    injector.destroy();
  });

  test('global toggle overlay is NOT injected into the page', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffle-toggle')).toBeNull();
    injector.destroy();
  });

  test('queue item count does not change after reshuffle', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    (document.getElementById('chapshuffle-reshuffle') as HTMLButtonElement).click();
    expect(document.querySelectorAll('.chapshuffle-item').length).toBe(5);
    injector.destroy();
  });

  test('updates the active row when playback auto-advances', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({ shuffleEnabled: true });
    addPlayerControls(document);
    addChapterItems(document, 5);
    const video = addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();

    expect(document.querySelector('.chapshuffle-active')?.getAttribute('data-index')).toBe('0');
    video.currentTime = 120;
    video.dispatchEvent(new Event('timeupdate'));

    expect(document.querySelector('.chapshuffle-active')?.getAttribute('data-index')).toBe('1');
    randomSpy.mockRestore();
    injector.destroy();
  });
});

// ── chapter progress bar ───────────────────────────────────────────────────

describe('UIInjector — chapter progress bar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('progress bar element exists in the rendered panel', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffle-progress')).not.toBeNull();
    injector.destroy();
  });

  test('progress bar width updates when video time changes', async () => {
    // Math.random=0 makes Fisher-Yates put the "1:00" chapter (60s–120s) at index 0
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    addPlayerControls(document);
    addChapterItems(document, 5);
    const video = addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    // queue[0] = chapter starting at 60s, ending at 120s; at 90s => 50%
    video.currentTime = 90;
    video.dispatchEvent(new Event('timeupdate'));

    const bar = document.getElementById('chapshuffle-progress') as HTMLElement;
    expect(bar.style.width).toBe('50%');
    randomSpy.mockRestore();
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
    expect(document.getElementById('chapshuffle-btn')).toBeNull();
    expect(document.getElementById('chapshuffle-queue')).toBeNull();
  });
});

// ── navigation ─────────────────────────────────────────────────────────────

describe('UIInjector — navigation (stale queue regression)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /**
   * Regression: opening the panel then navigating to a new video left the
   * Preact component mounted with Video A's chapters still visible.
   * yt-navigate-finish must tear everything down immediately.
   */
  test('yt-navigate-finish removes button and queue panel from DOM', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    // Open the panel — this is the state that triggered the stale-queue bug.
    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();
    expect(document.getElementById('chapshuffle-queue')).not.toBeNull();

    // Simulate YouTube navigation event.
    document.dispatchEvent(new Event('yt-navigate-finish'));

    // Both button and panel must be gone immediately (no timers needed).
    expect(document.getElementById('chapshuffle-btn')).toBeNull();
    expect(document.getElementById('chapshuffle-queue')).toBeNull();

    injector.destroy();
  });

  test('after yt-navigate-finish, new chapters are injected for the new video', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    // Open panel on Video A.
    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();
    const videoAItems = document.querySelectorAll('.chapshuffle-item').length;
    expect(videoAItems).toBe(5);

    // Simulate navigation: swap in Video B's DOM (8 chapters).
    document.body.innerHTML = '';
    addPlayerControls(document);
    addChapterItems(document, 8);
    addVideoElement(document);

    document.dispatchEvent(new Event('yt-navigate-finish'));

    // Navigation poll has a 1200ms initial delay, then a 500ms interval tick.
    // flushAll() (jest.runAllTimers) advances past both.
    await flushAll();

    expect(document.getElementById('chapshuffle-btn')).not.toBeNull();
    expect(document.querySelectorAll('.chapshuffle-item').length).toBe(8);

    injector.destroy();
  });

  test('mid-video resume starts at the correct chapter, not index 0', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    addPlayerControls(document);
    addChapterItems(document, 5); // chapters at 0, 60, 120, 180, 240 s
    const video = addVideoElement(document);
    // Resume at 210 s — inside Chapter 4 (180–240 s).
    video.currentTime = 210;

    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    // Open panel so the active row is rendered.
    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();

    // With Math.random=0 the queue is [C2@60, C3@120, C4@180, C5@240, C1@0].
    // Chapter 4@180s is at queue index 2. The active row should point there,
    // not at index 0, confirming _currentIndex was set correctly on construction.
    expect(document.querySelector('.chapshuffle-active')?.getAttribute('data-index')).toBe('2');

    // A timeupdate at currentTime=210 must not auto-advance (210 < end@240).
    video.dispatchEvent(new Event('timeupdate'));
    expect(document.querySelector('.chapshuffle-active')?.getAttribute('data-index')).toBe('2');

    jest.mocked(Math.random).mockRestore();
    injector.destroy();
  });

  /**
   * Regression: the previous fix stopped polling when parseChapters returned
   * null on the first tick after yt-navigate-finish. On YouTube, the event
   * fires before chapter DOM nodes exist, so the poll quit immediately and the
   * button was never injected for the new video.
   */
  test('chapters loading after yt-navigate-finish still triggers injection', async () => {
    // Start on Video A.
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffle-btn')).not.toBeNull();

    // Navigate: clear the DOM. New page has controls but NO chapters yet.
    document.body.innerHTML = '';
    addPlayerControls(document);
    addVideoElement(document);

    document.dispatchEvent(new Event('yt-navigate-finish'));

    // Tick 1: poll runs, chapters null → sig='\0', changed from '' → continue
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(document.getElementById('chapshuffle-btn')).toBeNull();

    // Chapters now arrive in the DOM (YouTube lazy-loaded them).
    addChapterItems(document, 6);

    // Tick 2: chapters found → new sig → changed from '\0' → continue
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(document.getElementById('chapshuffle-btn')).toBeNull();

    // Tick 3: same chapters → stable → inject
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(document.getElementById('chapshuffle-btn')).not.toBeNull();

    injector.destroy();
  });
});
