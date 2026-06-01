import {
  getExclusions,
  addExclusion,
  removeExclusion,
  clearExclusions,
} from '../src/exclusion/ExclusionManager';

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

describe('ExclusionManager.addExclusion()', () => {
  test('persists a new exclusion and is returned on subsequent reads', async () => {
    await addExclusion('vid1', 60);
    expect(await getExclusions('vid1')).toContain(60);
  });

  test('does not duplicate an already-excluded startSeconds', async () => {
    await addExclusion('vid1', 60);
    await addExclusion('vid1', 60);
    const exclusions = await getExclusions('vid1');
    expect(exclusions.filter((s) => s === 60)).toHaveLength(1);
  });

  test('exclusions for one video do not affect another video', async () => {
    await addExclusion('vid1', 60);
    expect(await getExclusions('vid2')).toEqual([]);
  });
});

describe('ExclusionManager.removeExclusion()', () => {
  test('un-persists an existing exclusion', async () => {
    await addExclusion('vid1', 60);
    await removeExclusion('vid1', 60);
    expect(await getExclusions('vid1')).not.toContain(60);
  });

  test('leaves other exclusions for the same video intact', async () => {
    await addExclusion('vid1', 60);
    await addExclusion('vid1', 120);
    await removeExclusion('vid1', 60);
    expect(await getExclusions('vid1')).toContain(120);
    expect(await getExclusions('vid1')).not.toContain(60);
  });

  test('is a no-op when startSeconds is not excluded', async () => {
    await addExclusion('vid1', 60);
    await removeExclusion('vid1', 999);
    expect(await getExclusions('vid1')).toEqual([60]);
  });
});

describe('ExclusionManager.clearExclusions()', () => {
  test('returns empty set after clearing', async () => {
    await addExclusion('vid1', 60);
    await addExclusion('vid1', 120);
    await clearExclusions('vid1');
    expect(await getExclusions('vid1')).toEqual([]);
  });

  test('clearing one video does not affect another video', async () => {
    await addExclusion('vid1', 60);
    await addExclusion('vid2', 90);
    await clearExclusions('vid1');
    expect(await getExclusions('vid2')).toContain(90);
  });
});
