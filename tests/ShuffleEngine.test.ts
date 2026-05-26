import { shuffle } from '../src/shuffle/ShuffleEngine';
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

  test('contains no duplicates', () => {
    const titles = shuffle(makeChapters(8)).map((c) => c.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test('output length matches input length', () => {
    expect(shuffle(makeChapters(10))).toHaveLength(10);
  });

  test('does not mutate the input array', () => {
    const input = makeChapters(6);
    const original = input.map((c) => ({ ...c }));
    shuffle(input);
    expect(input).toEqual(original);
  });

  test('works for exactly 5 items (minimum valid size)', () => {
    const input = makeChapters(5);
    const result = shuffle(input);
    expect(result).toHaveLength(5);
    expect(result).toEqual(expect.arrayContaining(input));
  });

  test('returns a single-element array unchanged', () => {
    expect(shuffle(makeChapters(1))).toEqual(makeChapters(1));
  });

  test('returns empty array for empty input', () => {
    expect(shuffle([])).toEqual([]);
  });

  test('output order differs from input for arrays > 2 items (statistical)', () => {
    const input = makeChapters(8);
    const inputStr = JSON.stringify(input);
    const allSame = Array.from({ length: 20 }).every(
      () => JSON.stringify(shuffle(input)) === inputStr
    );
    expect(allSame).toBe(false);
  });
});
