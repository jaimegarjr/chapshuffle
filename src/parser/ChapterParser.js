'use strict';

// YouTube renders its chapter list as a sequence of ytd-macro-markers-list-item-renderer
// elements. Each item contains a timestamp span and a title heading.
const CHAPTER_ITEM = 'ytd-macro-markers-list-item-renderer';
const TIMESTAMP_SEL = '#time, .ytd-macro-markers-list-item-renderer span[class*="time"], .time-string';
const TITLE_SEL = 'h4.yt-simple-endpoint, #video-title, h4[class]';

const MIN_CHAPTERS = 5;

/**
 * Parses "M:SS", "MM:SS", or "H:MM:SS" timestamp strings into total seconds.
 * Throws on malformed input rather than returning silently wrong values.
 */
function parseTimestamp(raw) {
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
 * @param {Document|Element} root - DOM root to query against (defaults to global document).
 * @returns {{ title: string, startSeconds: number }[] | null}
 */
function parse(root) {
  const doc = root || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const items = Array.from(doc.querySelectorAll(CHAPTER_ITEM));
  if (items.length < MIN_CHAPTERS) return null;

  const chapters = [];
  for (const item of items) {
    const timestampEl = item.querySelector(TIMESTAMP_SEL);
    const titleEl = item.querySelector(TITLE_SEL);

    if (!timestampEl || !titleEl) return null;

    const startSeconds = parseTimestamp(timestampEl.textContent);
    const title = titleEl.textContent.trim();
    if (!title) return null;

    chapters.push({ title, startSeconds });
  }

  return chapters;
}

module.exports = { parse, parseTimestamp };
