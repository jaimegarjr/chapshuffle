import { YouTubeChapterWatcher } from '../../src/youtube/YouTubeChapterWatcher';
import type { Chapter } from '../../src/types';

function makeChapters(count: number, prefix = 'Chapter'): Chapter[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `${prefix} ${i + 1}`,
    startSeconds: i * 60,
  }));
}

function addPlayerControls(doc: Document): Element {
  const el = doc.createElement('div');
  el.className = 'ytp-right-controls';
  doc.body.appendChild(el);
  return el;
}

function buildWatcher(
  doc: Document,
  overrides: Partial<{
    minChapters: number;
    isInjected: () => boolean;
    onNavigate: () => void;
    onChaptersReady: (chapters: Chapter[], controlsBar: Element) => void;
    onLivestream: () => void;
    readChapters: () => Chapter[] | null;
    requestRefresh: () => void;
  }> = {}
): YouTubeChapterWatcher {
  return new YouTubeChapterWatcher(doc, {
    minChapters: 5,
    isInjected: () => false,
    onNavigate: () => {},
    onChaptersReady: () => {},
    onLivestream: () => {},
    readChapters: () => null,
    ...overrides,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('YouTubeChapterWatcher', () => {
  test('waits for a stable chapter fingerprint before reporting chapters', () => {
    const controls = addPlayerControls(document);
    const onChaptersReady = jest.fn();
    let chapters: Chapter[] | null = null;
    const watcher = buildWatcher(document, {
      onChaptersReady,
      readChapters: () => chapters,
    });

    watcher.start();
    jest.advanceTimersByTime(500);
    expect(onChaptersReady).not.toHaveBeenCalled();

    chapters = makeChapters(5);
    jest.advanceTimersByTime(500);
    expect(onChaptersReady).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(onChaptersReady).toHaveBeenCalledTimes(1);
    expect(onChaptersReady).toHaveBeenCalledWith(expect.any(Array), controls);
    expect(onChaptersReady.mock.calls[0][0]).toHaveLength(5);

    watcher.destroy();
  });

  test('keeps polling until the chapter data arrives', () => {
    const controls = addPlayerControls(document);
    const onChaptersReady = jest.fn();
    let chapters: Chapter[] | null = null;
    const watcher = buildWatcher(document, {
      onChaptersReady,
      readChapters: () => chapters,
    });

    watcher.start();
    // Several empty ticks while the page world is still being queried.
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(500);
    }
    expect(onChaptersReady).not.toHaveBeenCalled();

    chapters = makeChapters(5);
    jest.advanceTimersByTime(500);
    jest.advanceTimersByTime(500);

    expect(onChaptersReady).toHaveBeenCalledTimes(1);
    expect(onChaptersReady.mock.calls[0][0]).toHaveLength(5);
    expect(onChaptersReady.mock.calls[0][1]).toBe(controls);

    watcher.destroy();
  });

  test('stops polling once chapters stay absent past the timeout', () => {
    addPlayerControls(document);
    const onChaptersReady = jest.fn();
    let chapters: Chapter[] | null = null;
    const watcher = buildWatcher(document, {
      onChaptersReady,
      readChapters: () => chapters,
    });

    watcher.start();
    // Poll well past the empty-poll budget with no chapters ever appearing.
    for (let i = 0; i < 40; i++) {
      jest.advanceTimersByTime(500);
    }
    // Chapters that appear after the watcher gave up are ignored (no leak).
    chapters = makeChapters(5);
    jest.advanceTimersByTime(500);
    jest.advanceTimersByTime(500);

    expect(onChaptersReady).not.toHaveBeenCalled();

    watcher.destroy();
  });

  test('requests a refresh from the chapter source on each poll', () => {
    addPlayerControls(document);
    const requestRefresh = jest.fn();
    const watcher = buildWatcher(document, { requestRefresh });

    watcher.start();
    jest.advanceTimersByTime(500);
    jest.advanceTimersByTime(500);

    expect(requestRefresh).toHaveBeenCalledTimes(2);

    watcher.destroy();
  });

  test('restarts polling after YouTube navigation', () => {
    addPlayerControls(document);
    let chapters: Chapter[] | null = makeChapters(5, 'A');
    const onNavigate = jest.fn();
    const onChaptersReady = jest.fn();
    const watcher = buildWatcher(document, {
      onNavigate,
      onChaptersReady,
      readChapters: () => chapters,
    });

    watcher.start();
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();
    expect(onChaptersReady.mock.calls[0][0][0]).toEqual({ title: 'A 1', startSeconds: 0 });

    chapters = makeChapters(6, 'B');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onChaptersReady).toHaveBeenCalledTimes(2);
    expect(onChaptersReady.mock.calls[1][0]).toHaveLength(6);
    expect(onChaptersReady.mock.calls[1][0][0]).toEqual({ title: 'B 1', startSeconds: 0 });

    watcher.destroy();
  });

  test('re-evaluates the current video when the activation threshold changes', () => {
    addPlayerControls(document);
    const chapters = makeChapters(4);
    const onChaptersReady = jest.fn();
    const watcher = buildWatcher(document, {
      minChapters: 5,
      onChaptersReady,
      readChapters: () => chapters,
    });

    watcher.start();
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();
    expect(onChaptersReady).not.toHaveBeenCalled();

    watcher.minChapters = 4;
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();

    expect(onChaptersReady).toHaveBeenCalledTimes(1);
    expect(onChaptersReady.mock.calls[0][0]).toHaveLength(4);

    watcher.destroy();
  });

  test('reports livestreams instead of waiting for chapters', () => {
    addPlayerControls(document);
    const liveMarker = document.createElement('div');
    liveMarker.className = 'ytp-live';
    document.body.appendChild(liveMarker);
    const onLivestream = jest.fn();
    const onChaptersReady = jest.fn();
    const watcher = buildWatcher(document, {
      onLivestream,
      onChaptersReady,
      readChapters: () => makeChapters(5),
    });

    watcher.start();
    jest.advanceTimersByTime(500);
    jest.advanceTimersByTime(500);

    expect(onLivestream).toHaveBeenCalledTimes(1);
    expect(onChaptersReady).not.toHaveBeenCalled();

    watcher.destroy();
  });
});
