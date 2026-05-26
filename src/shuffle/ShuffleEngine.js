'use strict';

/**
 * Returns a new array containing the same elements as `chapters` in a
 * randomized order. The input array is never mutated.
 *
 * @param {{ title: string, startSeconds: number }[]} chapters
 * @returns {{ title: string, startSeconds: number }[]}
 */
function shuffle(chapters) {
  if (!chapters || chapters.length === 0) return [];
  const copy = chapters.slice();
  // Fisher-Yates shuffle
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

module.exports = { shuffle };
