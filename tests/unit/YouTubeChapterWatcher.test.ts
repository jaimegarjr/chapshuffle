import { YouTubeChapterWatcher } from '../../src/youtube/YouTubeChapterWatcher';
import type { Chapter } from '../../src/types';

function addChapterItems(root: Element, count: number, prefix = 'Chapter'): void {
  const doc = root.ownerDocument;
  for (let i = 0; i < count; i++) {
    const item = doc.createElement('ytd-macro-markers-list-item-renderer');
    const ts = doc.createElement('span');
    ts.className = 'time-string';
    ts.textContent = `${i}:00`;
    const title = doc.createElement('h4');
    title.className = 'yt-simple-endpoint';
    title.textContent = `${prefix} ${i + 1}`;
    item.appendChild(ts);
    item.appendChild(title);
    root.appendChild(item);
  }
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
  }> = {}
): YouTubeChapterWatcher {
  return new YouTubeChapterWatcher(doc, {
    minChapters: 5,
    isInjected: () => false,
    onNavigate: () => {},
    onChaptersReady: () => {},
    onLivestream: () => {},
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
    const watcher = buildWatcher(document, { onChaptersReady });

    watcher.start();
    jest.advanceTimersByTime(500);
    expect(onChaptersReady).not.toHaveBeenCalled();

    addChapterItems(document.body, 5);
    jest.advanceTimersByTime(500);
    expect(onChaptersReady).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(onChaptersReady).toHaveBeenCalledTimes(1);
    expect(onChaptersReady).toHaveBeenCalledWith(expect.any(Array), controls);
    expect(onChaptersReady.mock.calls[0][0]).toHaveLength(5);

    watcher.destroy();
  });

  test('restarts polling after YouTube navigation', () => {
    addPlayerControls(document);
    addChapterItems(document.body, 5, 'A');
    const onNavigate = jest.fn();
    const onChaptersReady = jest.fn();
    const watcher = buildWatcher(document, { onNavigate, onChaptersReady });

    watcher.start();
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();
    expect(onChaptersReady.mock.calls[0][0][0]).toEqual({ title: 'A 1', startSeconds: 0 });

    document.body.innerHTML = '';
    addPlayerControls(document);
    addChapterItems(document.body, 6, 'B');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onChaptersReady).toHaveBeenCalledTimes(2);
    expect(onChaptersReady.mock.calls[1][0]).toHaveLength(6);
    expect(onChaptersReady.mock.calls[1][0][0]).toEqual({ title: 'B 1', startSeconds: 0 });

    watcher.destroy();
  });

  test('uses the last macro marker list as the current chapter root', () => {
    addPlayerControls(document);
    const oldList = document.createElement('ytd-macro-markers-list-renderer');
    const newList = document.createElement('ytd-macro-markers-list-renderer');
    document.body.appendChild(oldList);
    document.body.appendChild(newList);
    addChapterItems(oldList, 5, 'Old');
    addChapterItems(newList, 6, 'New');

    const onChaptersReady = jest.fn();
    const watcher = buildWatcher(document, { onChaptersReady });

    watcher.start();
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();

    expect(onChaptersReady).toHaveBeenCalledTimes(1);
    expect(onChaptersReady.mock.calls[0][0]).toHaveLength(6);
    expect(onChaptersReady.mock.calls[0][0][0]).toEqual({ title: 'New 1', startSeconds: 0 });

    watcher.destroy();
  });

  test('reports livestreams instead of waiting for chapters', () => {
    addPlayerControls(document);
    const liveMarker = document.createElement('div');
    liveMarker.className = 'ytp-live';
    document.body.appendChild(liveMarker);
    const onLivestream = jest.fn();
    const onChaptersReady = jest.fn();
    const watcher = buildWatcher(document, { onLivestream, onChaptersReady });

    watcher.start();
    jest.advanceTimersByTime(500);
    jest.advanceTimersByTime(500);

    expect(onLivestream).toHaveBeenCalledTimes(1);
    expect(onChaptersReady).not.toHaveBeenCalled();

    watcher.destroy();
  });
});
