import { shuffle, shuffleExcluding } from '../src/shuffle/ShuffleEngine';
import type { Chapter } from '../src/types';

function makeChapters(n: number): Chapter[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Chapter ${i + 1}`,
    startSeconds: i * 60,
  }));
}

describe('ShuffleEngine.shuffle()', () => {
  test('returns same elements as input', () => {
    const input = makeChapters(8);
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect(result).toEqual(expect.arrayContaining(input));
    expect(input).toEqual(expect.arrayContaining(result));
  });

  test('does not mutate the input array', () => {
    const input = makeChapters(6);
    const original = input.map((c) => ({ ...c }));
    shuffle(input);
    expect(input).toEqual(original);
  });

  test('returns a single-element array unchanged', () => {
    expect(shuffle(makeChapters(1))).toEqual(makeChapters(1));
  });

  test('returns empty array for empty input', () => {
    expect(shuffle([])).toEqual([]);
  });
});

describe('ShuffleEngine.shuffleExcluding()', () => {
  test('excludes chapters whose startSeconds are in the exclusion set', () => {
    const chapters = makeChapters(5);
    const excluded = new Set([0, 120]);
    const result = shuffleExcluding(chapters, excluded);
    for (const chapter of result) {
      expect(excluded.has(chapter.startSeconds)).toBe(false);
    }
  });

  test('all non-excluded chapters appear in the result', () => {
    const chapters = makeChapters(5);
    const excluded = new Set([0, 120]);
    const result = shuffleExcluding(chapters, excluded);
    const expected = chapters.filter((c) => !excluded.has(c.startSeconds));
    expect(result).toHaveLength(expected.length);
    expect(result).toEqual(expect.arrayContaining(expected));
  });

  test('empty exclusion set produces a shuffle of all chapters', () => {
    const chapters = makeChapters(5);
    const result = shuffleExcluding(chapters, new Set());
    expect(result).toHaveLength(chapters.length);
    expect(result).toEqual(expect.arrayContaining(chapters));
  });

  test('excluding all chapters returns an empty array', () => {
    const chapters = makeChapters(3);
    const excluded = new Set(chapters.map((c) => c.startSeconds));
    expect(shuffleExcluding(chapters, excluded)).toEqual([]);
  });
});
