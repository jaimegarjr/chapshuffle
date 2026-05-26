import type { Chapter } from '../types';

/**
 * Returns a new array containing the same elements as `chapters` in a
 * randomized order (Fisher-Yates). The input array is never mutated.
 */
export function shuffle(chapters: Chapter[]): Chapter[] {
  if (!chapters || chapters.length === 0) return [];
  const copy = chapters.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
