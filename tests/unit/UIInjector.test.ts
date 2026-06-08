import { UIInjector } from '../../src/ui/UIInjector';

function buildChromeMock(initialStore: Record<string, unknown> = {}) {
  const store = { ...initialStore };
  const storageArea = {
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
  };
  return {
    runtime: {
      lastError: null as { message: string } | null,
      sendMessage: () => {},
    },
    storage: {
      sync: storageArea,
      local: storageArea,
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

function dragItem(fromIndex: number, toIndex: number): void {
  const data = new Map<string, string>();
  const dataTransfer = {
    effectAllowed: '',
    dropEffect: '',
    setData: jest.fn((type: string, value: string) => data.set(type, value)),
    getData: jest.fn((type: string) => data.get(type) ?? ''),
  };
  const items = () => Array.from(document.querySelectorAll<HTMLElement>('.chapshuffle-item'));
  const start = new Event('dragstart', { bubbles: true, cancelable: true });
  Object.defineProperty(start, 'dataTransfer', { value: dataTransfer });
  items()[fromIndex].dispatchEvent(start);

  const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
  Object.defineProperty(dragOver, 'dataTransfer', { value: dataTransfer });
  items()[toIndex].dispatchEvent(dragOver);

  const drop = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
  items()[toIndex].dispatchEvent(drop);
}

async function flushAll(): Promise<void> {
  jest.runAllTimers();
  await Promise.resolve();
  await Promise.resolve();
}

describe('UIInjector — injection guard', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('does not inject when the video has fewer chapters than the configured threshold', async () => {
    addPlayerControls(document);
    addChapterItems(document, 4);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    expect(document.getElementById('chapshuffle-btn')).toBeNull();
    injector.destroy();
  });

  test('injects when a valid chapter list meets a lower configured threshold', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({ minChapters: 2 });
    addPlayerControls(document);
    addChapterItems(document, 2);
    addVideoElement(document);
    const injector = new UIInjector(document);

    await injector.init();
    await flushAll();

    expect(document.getElementById('chapshuffle-btn')).not.toBeNull();
    expect(document.querySelectorAll('.chapshuffle-item')).toHaveLength(2);
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
    await flushAll();
    const rows = document.querySelectorAll('.chapshuffle-item');
    expect(rows.length).toBe(5);
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
    expect(document.getElementById('chapshuffle-queue')!.style.display).toBe('flex');
    injector.destroy();
  });

  test('opening the panel positions it over the video', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    const video = addVideoElement(document);
    video.getBoundingClientRect = jest.fn(
      () =>
        ({
          x: 100,
          y: 50,
          top: 50,
          right: 900,
          bottom: 550,
          left: 100,
          width: 800,
          height: 500,
          toJSON: () => ({}),
        }) as DOMRect
    );

    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();

    const panel = document.getElementById('chapshuffle-queue') as HTMLDivElement;
    expect(panel.style.top).toBe('auto');
    expect(panel.style.left).toBe('516px');
    expect(panel.style.bottom).toBe('290px');
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
    expect(document.querySelectorAll('.chapshuffle-drag-handle').length).toBe(5);
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
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      shuffleEnabled: true,
    });
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

  test('dragging a row before another row rearranges the queue', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();
    const beforeTitles = Array.from(document.querySelectorAll('.chapshuffle-title')).map(
      (el) => el.textContent
    );

    dragItem(4, 1);

    const titles = Array.from(document.querySelectorAll('.chapshuffle-title')).map(
      (el) => el.textContent
    );
    expect(titles).toEqual([
      beforeTitles[0],
      beforeTitles[4],
      beforeTitles[1],
      beforeTitles[2],
      beforeTitles[3],
    ]);
    randomSpy.mockRestore();
    injector.destroy();
  });
});

describe('UIInjector — chapter progress bar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('progress bar width updates when video time changes', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    addPlayerControls(document);
    addChapterItems(document, 5);
    const video = addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    video.currentTime = 90;
    video.dispatchEvent(new Event('timeupdate'));

    const bar = document.getElementById('chapshuffle-progress') as HTMLElement;
    expect(bar.style.width).toBe('50%');
    randomSpy.mockRestore();
    injector.destroy();
  });
});

describe('UIInjector — exclusion editing mode', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('normal queue hides row exclusion buttons and exposes exclusion mode from the footer', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    expect(document.querySelectorAll('.chapshuffle-ban')).toHaveLength(0);
    expect(document.getElementById('chapshuffle-edit-exclusions')).not.toBeNull();
    expect(document.getElementById('chapshuffle-queue-title')?.textContent).toBe('Shuffle Queue');

    injector.destroy();
  });

  test('exclusion mode shows all chapters in original order without drag handles', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    (document.getElementById('chapshuffle-edit-exclusions') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(document.getElementById('chapshuffle-queue')?.getAttribute('data-mode')).toBe(
      'exclusions'
    );
    expect(document.getElementById('chapshuffle-queue-title')?.textContent).toBe('Edit Exclusions');
    expect(document.querySelectorAll('.chapshuffle-drag-handle')).toHaveLength(0);
    expect(
      Array.from(document.querySelectorAll('.chapshuffle-title')).map((el) => el.textContent)
    ).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5']);

    randomSpy.mockRestore();
    injector.destroy();
  });

  test('clicking a row in exclusion mode removes that chapter from the playable queue', async () => {
    window.history.replaceState(null, '', '/watch?v=video-1');
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    (document.getElementById('chapshuffle-edit-exclusions') as HTMLButtonElement).click();
    await Promise.resolve();
    const chapterThreeRow = Array.from(
      document.querySelectorAll<HTMLElement>('.chapshuffle-item')
    ).find((row) => row.querySelector('.chapshuffle-title')?.textContent === 'Chapter 3');
    chapterThreeRow?.click();
    await Promise.resolve();
    (document.getElementById('chapshuffle-exclusion-done') as HTMLButtonElement).click();
    await Promise.resolve();

    const titles = Array.from(document.querySelectorAll('.chapshuffle-title')).map(
      (el) => el.textContent
    );
    expect(titles).not.toContain('Chapter 3');

    randomSpy.mockRestore();
    injector.destroy();
  });

  test('drafting an exclusion does not seek until Done is clicked', async () => {
    window.history.replaceState(null, '', '/watch?v=video-2');
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    addPlayerControls(document);
    addChapterItems(document, 5);
    const video = addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    const currentTitle = document.querySelector(
      '.chapshuffle-active .chapshuffle-title'
    )?.textContent;
    expect(currentTitle).toBe('Chapter 2');
    expect(video.currentTime).toBe(0);

    (document.getElementById('chapshuffle-edit-exclusions') as HTMLButtonElement).click();
    await Promise.resolve();
    const currentChapterRow = Array.from(
      document.querySelectorAll<HTMLElement>('.chapshuffle-item')
    ).find((row) => row.querySelector('.chapshuffle-title')?.textContent === currentTitle);
    currentChapterRow?.click();
    await Promise.resolve();

    expect(video.currentTime).toBe(0);

    (document.getElementById('chapshuffle-exclusion-done') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(video.currentTime).toBe(120);

    randomSpy.mockRestore();
    injector.destroy();
  });

  test('exclusion mode keeps at least one chapter included', async () => {
    window.history.replaceState(null, '', '/watch?v=video-3');
    const chromeMock = buildChromeMock();
    (global as unknown as Record<string, unknown>).chrome = chromeMock;
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    (document.getElementById('chapshuffle-edit-exclusions') as HTMLButtonElement).click();
    await Promise.resolve();

    const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.chapshuffle-item'));
    for (const row of rows().slice(0, 4)) {
      row.click();
      await Promise.resolve();
    }

    const lastIncludedRow = rows()[4];
    expect(lastIncludedRow.getAttribute('aria-disabled')).toBe('true');
    expect(lastIncludedRow.querySelector('.chapshuffle-exclusion-state')?.textContent).toBe(
      'Included'
    );

    lastIncludedRow.click();
    await Promise.resolve();

    expect(lastIncludedRow.querySelector('.chapshuffle-exclusion-state')?.textContent).toBe(
      'Included'
    );

    (document.getElementById('chapshuffle-exclusion-done') as HTMLButtonElement).click();
    await Promise.resolve();

    const queueTitles = Array.from(document.querySelectorAll('.chapshuffle-title')).map(
      (el) => el.textContent
    );
    expect(queueTitles).not.toContain('Chapter 1');
    expect(queueTitles).toContain('Chapter 5');

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
    expect(document.getElementById('chapshuffle-btn')).toBeNull();
    expect(document.getElementById('chapshuffle-queue')).toBeNull();
  });
});

describe('UIInjector — navigation (stale queue regression)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('yt-navigate-finish removes button and queue panel from DOM', async () => {
    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();
    expect(document.getElementById('chapshuffle-queue')).not.toBeNull();

    document.dispatchEvent(new Event('yt-navigate-finish'));

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

    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();
    const videoAItems = document.querySelectorAll('.chapshuffle-item').length;
    expect(videoAItems).toBe(5);

    document.body.innerHTML = '';
    addPlayerControls(document);
    addChapterItems(document, 8);
    addVideoElement(document);

    document.dispatchEvent(new Event('yt-navigate-finish'));

    await flushAll();

    expect(document.getElementById('chapshuffle-btn')).not.toBeNull();
    expect(document.querySelectorAll('.chapshuffle-item').length).toBe(8);

    injector.destroy();
  });

  test('a session that finishes loading after navigation cannot mount stale chapters', async () => {
    window.history.replaceState(null, '', '/watch?v=video-a');
    const chromeMock = buildChromeMock();
    const exclusionReads: Array<(result: Record<string, unknown>) => void> = [];
    chromeMock.storage.local = {
      ...chromeMock.storage.local,
      get: (_keys, callback) => exclusionReads.push(callback),
    };
    (global as unknown as Record<string, unknown>).chrome = chromeMock;

    addPlayerControls(document);
    addChapterItems(document, 5);
    addVideoElement(document);
    const injector = new UIInjector(document);
    await injector.init();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(exclusionReads).toHaveLength(1);

    document.body.innerHTML = '';
    window.history.replaceState(null, '', '/watch?v=video-b');
    addPlayerControls(document);
    addChapterItems(document, 8);
    addVideoElement(document);
    document.dispatchEvent(new Event('yt-navigate-finish'));
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(exclusionReads).toHaveLength(2);

    exclusionReads[0]({ chapterExclusions: { 'video-a': [60] } });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById('chapshuffle-btn')).toBeNull();

    exclusionReads[1]({});
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById('chapshuffle-btn')).not.toBeNull();
    expect(document.querySelectorAll('.chapshuffle-item')).toHaveLength(8);

    injector.destroy();
  });

  test('mid-video resume makes the current chapter the first queue item', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    addPlayerControls(document);
    addChapterItems(document, 5);
    const video = addVideoElement(document);
    video.currentTime = 210;

    const injector = new UIInjector(document);
    await injector.init();
    await flushAll();

    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();

    expect(document.querySelector('.chapshuffle-active')?.getAttribute('data-index')).toBe('0');
    expect(document.querySelector('.chapshuffle-active .chapshuffle-title')?.textContent).toBe(
      'Chapter 4'
    );

    video.dispatchEvent(new Event('timeupdate'));
    expect(document.querySelector('.chapshuffle-active')?.getAttribute('data-index')).toBe('0');

    jest.mocked(Math.random).mockRestore();
    injector.destroy();
  });
});
