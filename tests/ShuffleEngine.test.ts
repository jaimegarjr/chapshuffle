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
