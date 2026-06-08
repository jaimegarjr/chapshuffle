import { SessionController } from '../../src/playback/SessionController';
import type { Chapter } from '../../src/types';

function buildChromeMock(initialStore: Record<string, unknown> = {}) {
  const store = { ...initialStore };
  const storageArea = {
    get: (keys: string[], cb: (r: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> = {};
      for (const k of keys) if (k in store) result[k] = store[k];
      cb(result);
    },
    set: jest.fn((items: Record<string, unknown>, cb: () => void) => {
      Object.assign(store, items);
      cb();
    }),
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

function createSession(
  overrides: Partial<Parameters<typeof SessionController.create>[0]> = {}
): Promise<SessionController> {
  return SessionController.create({
    video: makeVideo(),
    chapters: makeChapters(5),
    videoId: null,
    autoAdvance: false,
    queueEndBehavior: 'reshuffle',
    onUpdate: () => {},
    ...overrides,
  });
}

beforeEach(() => {
  (global as unknown as Record<string, unknown>).chrome = buildChromeMock();
});
afterEach(() => {
  delete (global as unknown as Record<string, unknown>).chrome;
});

describe('SessionController — snapshot', () => {
  test('snapshot reflects initial queue state', async () => {
    const chapters = makeChapters(5);
    const video = makeVideo();
    const session = await createSession({ video, chapters });

    const snap = session.snapshot;
    expect(snap.allChapters).toHaveLength(5);
    expect(snap.queue).toHaveLength(5);
    expect(snap.currentIndex).toBe(0);
    expect(snap.loopMode).toBe(false);
    expect(snap.excludedSeconds.size).toBe(0);

    session.destroy();
  });
});

describe('SessionController — creation', () => {
  test('loads stored exclusions without persisting them again', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const chromeMock = buildChromeMock({
      chapterExclusions: { 'vid-1': [60] },
    });
    (global as unknown as Record<string, unknown>).chrome = chromeMock;

    const session = await SessionController.create({
      video: makeVideo(),
      chapters: makeChapters(3),
      videoId: 'vid-1',
      autoAdvance: false,
      queueEndBehavior: 'reshuffle',
      onUpdate: () => {},
    });

    expect(session.snapshot.excludedSeconds).toEqual(new Set([60]));
    expect(
      session.snapshot.queue.map((chapter) => chapter.startSeconds).sort((a, b) => a - b)
    ).toEqual([0, 120]);
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });

  test('ignores stored exclusions that would remove every chapter', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      chapterExclusions: { 'vid-2': [0, 60, 120] },
    });

    const session = await createSession({
      chapters: makeChapters(3),
      videoId: 'vid-2',
    });

    expect(session.snapshot.queue).toHaveLength(3);
    expect(session.snapshot.excludedSeconds).toEqual(new Set());

    session.destroy();
  });
});

describe('SessionController — loop mode', () => {
  test('toggle-loop flips loopMode in snapshot', async () => {
    const session = await createSession();

    expect(session.snapshot.loopMode).toBe(false);
    session.perform({ type: 'toggle-loop' });
    expect(session.snapshot.loopMode).toBe(true);
    session.perform({ type: 'toggle-loop' });
    expect(session.snapshot.loopMode).toBe(false);

    session.destroy();
  });
});

describe('SessionController — reshuffle action', () => {
  test('reshuffle produces the same chapters in potentially different order', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const chapters = makeChapters(5);
    const session = await createSession({ chapters });

    const before = session.snapshot.queue.map((c) => c.title);
    session.perform({ type: 'reshuffle' });
    const after = session.snapshot.queue.map((c) => c.title);

    expect(after).toHaveLength(5);
    expect(after.sort()).toEqual(before.sort());

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });
});

describe('SessionController — seek action', () => {
  test('updates currentIndex in snapshot', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const session = await createSession();

    expect(session.snapshot.currentIndex).toBe(0);
    session.perform({ type: 'seek', index: 2 });
    expect(session.snapshot.currentIndex).toBe(2);

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });
});

describe('SessionController — actions', () => {
  test('performs relative navigation from the current session state', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const session = await createSession();

    session.perform({ type: 'next' });
    expect(session.snapshot.currentIndex).toBe(1);

    session.perform({ type: 'previous' });
    expect(session.snapshot.currentIndex).toBe(0);

    session.perform({ type: 'previous' });
    expect(session.snapshot.currentIndex).toBe(0);

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });
});

describe('SessionController — exclusion actions', () => {
  test('excluded chapters are removed from the queue', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const chapters = makeChapters(5);
    const session = await createSession({ chapters, videoId: 'vid-1' });

    // Chapter 3 starts at 120s
    session.perform({ type: 'apply-exclusions', excludedSeconds: new Set([120]) });
    await Promise.resolve();

    const titles = session.snapshot.queue.map((c) => c.title);
    expect(titles).not.toContain('Chapter 3');
    expect(session.snapshot.excludedSeconds.has(120)).toBe(true);

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });

  test('persists exclusions to chrome storage', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const chromeMock = buildChromeMock();
    (global as unknown as Record<string, unknown>).chrome = chromeMock;

    const session = await createSession({ videoId: 'vid-2' });
    session.perform({ type: 'apply-exclusions', excludedSeconds: new Set([60]) });
    await Promise.resolve();
    await Promise.resolve(); // flush nested async in setExclusions

    const stored = (chromeMock.storage.local._store.chapterExclusions as Record<string, number[]>)[
      'vid-2'
    ];
    expect(stored).toContain(60);

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });

  test('will not exclude all chapters', async () => {
    const chapters = makeChapters(3);
    const session = await createSession({ chapters, videoId: 'vid-3' });

    // Try to exclude all 3 chapters
    session.perform({
      type: 'apply-exclusions',
      excludedSeconds: new Set([0, 60, 120]),
    });
    await Promise.resolve();

    // All should still be in queue
    expect(session.snapshot.queue).toHaveLength(3);
    expect(session.snapshot.excludedSeconds.size).toBe(0);

    session.destroy();
  });

  test('restoring a chapter adds it back to the queue', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const chapters = makeChapters(5);
    const session = await createSession({ chapters, videoId: 'vid-4' });

    // Exclude chapter 2 (60s)
    session.perform({ type: 'apply-exclusions', excludedSeconds: new Set([60]) });
    await Promise.resolve();
    expect(session.snapshot.queue.map((c) => c.title)).not.toContain('Chapter 2');

    // Restore chapter 2
    session.perform({ type: 'apply-exclusions', excludedSeconds: new Set() });
    await Promise.resolve();
    expect(session.snapshot.queue.map((c) => c.title)).toContain('Chapter 2');

    jest.mocked(Math.random).mockRestore();
    session.destroy();
  });
});

describe('SessionController — onUpdate', () => {
  test('onUpdate fires when video timeupdate event fires', async () => {
    const onUpdate = jest.fn();
    const video = makeVideo();
    const session = await createSession({ video, onUpdate });

    video.dispatchEvent(new Event('timeupdate'));

    // onUpdate may fire more than once (controller internals), just verify at least once
    expect(onUpdate).toHaveBeenCalled();

    session.destroy();
  });

  test('destroy() stops onUpdate from firing on timeupdate', async () => {
    const onUpdate = jest.fn();
    const video = makeVideo();
    const session = await createSession({ video, onUpdate });

    session.destroy();
    onUpdate.mockClear();

    video.dispatchEvent(new Event('timeupdate'));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
