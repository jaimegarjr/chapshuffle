import type { Chapter } from '../types';

export function shuffle(chapters: Chapter[]): Chapter[] {
  if (chapters.length === 0) return [];
  const copy = chapters.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
