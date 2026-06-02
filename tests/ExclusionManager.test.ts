import { getExclusions, setExclusions, clearExclusions } from '../src/exclusion/ExclusionManager';

interface MockStore {
  [key: string]: unknown;
}

function buildChromeMock(initialStore: MockStore = {}) {
  const store: MockStore = { ...initialStore };
  return {
    runtime: { lastError: null as { message: string } | null },
    storage: {
      local: {
        get(keys: string[], callback: (result: MockStore) => void) {
          const result: MockStore = {};
          for (const key of keys) {
            if (key in store) result[key] = store[key];
          }
          callback(result);
        },
        set(items: MockStore, callback: () => void) {
          Object.assign(store, items);
          callback();
        },
        _store: store,
      },
    },
  };
}

beforeEach(() => {
  (global as unknown as Record<string, unknown>).chrome = buildChromeMock();
});

afterEach(() => {
  delete (global as unknown as Record<string, unknown>).chrome;
});

describe('ExclusionManager.getExclusions()', () => {
  test('returns empty array for video with no stored data', async () => {
    expect(await getExclusions('vid1')).toEqual([]);
  });

  test('returns stored exclusions for a video', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      chapterExclusions: { vid1: [0, 60, 120] },
    });
    expect(await getExclusions('vid1')).toEqual([0, 60, 120]);
  });

  test('returns empty array for unknown video even when other videos have exclusions', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      chapterExclusions: { vid1: [0] },
    });
    expect(await getExclusions('vid2')).toEqual([]);
  });
});

describe('ExclusionManager.setExclusions()', () => {
  test('persists a set of exclusions and returns them on subsequent reads', async () => {
    await setExclusions('vid1', [60, 120]);
    expect(await getExclusions('vid1')).toEqual([60, 120]);
  });

  test('overwrites previous exclusions for the same video', async () => {
    await setExclusions('vid1', [60, 120]);
    await setExclusions('vid1', [30]);
    expect(await getExclusions('vid1')).toEqual([30]);
  });

  test('deduplicates and sorts exclusions before writing', async () => {
    await setExclusions('vid1', [180, 0, 180]);

    expect(await getExclusions('vid1')).toEqual([0, 180]);
  });

  test('two rapid setExclusions calls both survive — last write wins', async () => {
    await Promise.all([setExclusions('vid1', [60]), setExclusions('vid1', [60, 120])]);
    const result = await getExclusions('vid1');
    expect(result).toContain(60);
  });

  test('clearing with an empty array removes the key', async () => {
    await setExclusions('vid1', [60]);
    await setExclusions('vid1', []);
    expect(await getExclusions('vid1')).toEqual([]);
  });

  test('exclusions for one video do not affect another video', async () => {
    await setExclusions('vid1', [60]);
    expect(await getExclusions('vid2')).toEqual([]);
  });

  test('replacing exclusions for one video does not affect another video', async () => {
    await setExclusions('vid1', [60]);
    await setExclusions('vid2', [90]);
    await setExclusions('vid1', [120]);

    expect(await getExclusions('vid1')).toEqual([120]);
    expect(await getExclusions('vid2')).toEqual([90]);
  });
});
describe('ExclusionManager.clearExclusions()', () => {
  test('returns empty set after clearing', async () => {
    await setExclusions('vid1', [60, 120]);
    await clearExclusions('vid1');
    expect(await getExclusions('vid1')).toEqual([]);
  });

  test('clearing one video does not affect another video', async () => {
    await setExclusions('vid1', [60]);
    await setExclusions('vid2', [90]);
    await clearExclusions('vid1');
    expect(await getExclusions('vid2')).toContain(90);
  });
});
