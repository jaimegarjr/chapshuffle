import { SessionController } from '../src/playback/SessionController';
import type { Chapter } from '../src/types';

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
    runtime: { lastError: null as { message: string } | null },
    storage: { local: storageArea },
  };
}

function makeChapters(count: number): Chapter[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Chapter ${i + 1}`,
    startSeconds: i * 60,
  }));
}

function makeVideo(currentTime = 0): HTMLVideoElement {
  const video = document.createElement('video');
  video.currentTime = currentTime;
  Object.defineProperty(video, 'duration', { value: 600, configurable: true });
  return video;
}

beforeEach(() => {
  (global as unknown as Record<string, unknown>).chrome = buildChromeMock();
});
afterEach(() => {
  delete (global as unknown as Record<string, unknown>).chrome;
});

describe('SessionController — snapshot', () => {
  test('snapshot reflects initial queue state', () => {
    const chapters = makeChapters(5);
    const video = makeVideo();
    const session = new SessionController(video, chapters, null, false, 'reshuffle', () => { });

    const snap = session.snapshot;
    expect(snap.allChapters).toHaveLength(5);
    expect(snap.queue).toHaveLength(5);
    expect(snap.currentIndex).toBe(0);
    expect(snap.loopMode).toBe(false);
    expect(snap.excludedSeconds.size).toBe(0);

    session.destroy();
  });
});

describe('SessionController — loop mode', () => {
  test('toggleLoopMode flips loopMode in snapshot', () => {
    const session = new SessionController(makeVideo(), makeChapters(5), null, false, 'reshuffle', () => { });

    expect(session.snapshot.loopMode).toBe(false);
    session.toggleLoopMode();
    expect(session.snapshot.loopMode).toBe(true);
    session.toggleLoopMode();
    expect(session.snapshot.loopMode).toBe(false);

    session.destroy();
  });
});

describe('SessionController — reshuffle', () => {
  test('reshuffle produces the same chapters in potentially different order', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const chapters = makeChapters(5);
    const session = new SessionController(makeVideo(), chapters, null, false, 'reshuffle', () => { });

    const before = session.snapshot.queue.map((c) => c.title);
    session.reshuffle();
    const after = session.snapshot.queue.map((c) => c.title);

    expect(after).toHaveLength(5);
    expect(after.sort()).toEqual(before.sort());

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });
});

describe('SessionController — seekToChapter', () => {
  test('seekToChapter updates currentIndex in snapshot', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const session = new SessionController(makeVideo(), makeChapters(5), null, false, 'reshuffle', () => { });

    expect(session.snapshot.currentIndex).toBe(0);
    session.seekToChapter(2);
    expect(session.snapshot.currentIndex).toBe(2);

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });
});

describe('SessionController — applyExclusions', () => {
  test('excluded chapters are removed from the queue', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const chapters = makeChapters(5);
    const session = new SessionController(makeVideo(), chapters, 'vid-1', false, 'reshuffle', () => { });

    // Chapter 3 starts at 120s
    session.applyExclusions(new Set([120]));
    await Promise.resolve();

    const titles = session.snapshot.queue.map((c) => c.title);
    expect(titles).not.toContain('Chapter 3');
    expect(session.snapshot.excludedSeconds.has(120)).toBe(true);

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });

  test('applyExclusions persists to chrome storage', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const chromeMock = buildChromeMock();
    (global as unknown as Record<string, unknown>).chrome = chromeMock;

    const session = new SessionController(makeVideo(), makeChapters(5), 'vid-2', false, 'reshuffle', () => { });
    session.applyExclusions(new Set([60]));
    await Promise.resolve();
    await Promise.resolve(); // flush nested async in setExclusions

    const stored = (chromeMock.storage.local._store.chapterExclusions as Record<string, number[]>)['vid-2'];
    expect(stored).toContain(60);

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });

  test('applyExclusions will not exclude all chapters', async () => {
    const chapters = makeChapters(3);
    const session = new SessionController(makeVideo(), chapters, 'vid-3', false, 'reshuffle', () => { });

    // Try to exclude all 3 chapters
    session.applyExclusions(new Set([0, 60, 120]));
    await Promise.resolve();

    // All should still be in queue
    expect(session.snapshot.queue).toHaveLength(3);
    expect(session.snapshot.excludedSeconds.size).toBe(0);

    session.destroy();
  });

  test('restoring a chapter adds it back to the queue', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const chapters = makeChapters(5);
    const session = new SessionController(makeVideo(), chapters, 'vid-4', false, 'reshuffle', () => { });

    // Exclude chapter 2 (60s)
    session.applyExclusions(new Set([60]));
    await Promise.resolve();
    expect(session.snapshot.queue.map((c) => c.title)).not.toContain('Chapter 2');

    // Restore chapter 2
    session.applyExclusions(new Set([]));
    await Promise.resolve();
    expect(session.snapshot.queue.map((c) => c.title)).toContain('Chapter 2');

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });
});

describe('SessionController — onUpdate', () => {
  test('onUpdate fires when video timeupdate event fires', () => {
    const onUpdate = jest.fn();
    const video = makeVideo();
    const session = new SessionController(video, makeChapters(5), null, false, 'reshuffle', onUpdate);

    video.dispatchEvent(new Event('timeupdate'));

    // onUpdate may fire more than once (controller internals), just verify at least once
    expect(onUpdate).toHaveBeenCalled();

    session.destroy();
  });

  test('destroy() stops onUpdate from firing on timeupdate', () => {
    const onUpdate = jest.fn();
    const video = makeVideo();
    const session = new SessionController(video, makeChapters(5), null, false, 'reshuffle', onUpdate);

    session.destroy();
    onUpdate.mockClear();

    video.dispatchEvent(new Event('timeupdate'));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
