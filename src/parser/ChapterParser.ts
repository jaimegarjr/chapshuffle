import type { Chapter } from '../types';

const CHAPTER_ITEM = 'ytd-macro-markers-list-item-renderer';
const TIMESTAMP_SEL =
  '#time, .ytd-macro-markers-list-item-renderer span[class*="time"], .time-string';
const TITLE_SEL = 'h4.yt-simple-endpoint, #video-title, h4[class]';

const MIN_CHAPTERS = 5;

/**
 * Parses "M:SS", "MM:SS", or "H:MM:SS" timestamp strings into total seconds.
 * Throws on malformed input rather than returning silently wrong values.
 */
export function parseTimestamp(raw: string): number {
  const str = raw.trim();
  const parts = str.split(':');
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`Malformed timestamp: "${str}"`);
  }
  const nums = parts.map((p) => {
    const n = parseInt(p, 10);
    if (isNaN(n) || p.trim() === '') throw new Error(`Malformed timestamp: "${str}"`);
    return n;
  });
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

/**
 * Parses chapter data from the YouTube DOM.
 *
 * @param root - DOM root to query against (defaults to global document).
 * @returns Structured chapter array, or null when fewer than 5 chapters are found.
 */
export function parse(root?: Document | Element): Chapter[] | null {
  const doc: Document | Element | null =
    root ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const items = Array.from(doc.querySelectorAll(CHAPTER_ITEM));
  if (items.length < MIN_CHAPTERS) return null;

  const seen = new Set<number>();
  const chapters: Chapter[] = [];
  for (const item of items) {
    const timestampEl = item.querySelector(TIMESTAMP_SEL);
    const titleEl = item.querySelector(TITLE_SEL);

    if (!timestampEl || !titleEl) return null;

    const startSeconds = parseTimestamp(timestampEl.textContent ?? '');
    const title = titleEl.textContent?.trim() ?? '';
    if (!title) return null;

    // YouTube sometimes renders multiple DOM layers for the same chapter marker.
    // Keep only the first occurrence of each timestamp.
    if (seen.has(startSeconds)) continue;
    seen.add(startSeconds);

    chapters.push({ title, startSeconds });
  }

  return chapters;
}
