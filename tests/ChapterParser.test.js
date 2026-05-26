/**
 * @jest-environment jsdom
 */
'use strict';

const { parse, parseTimestamp } = require('../src/parser/ChapterParser');

// Builds a minimal YouTube-like chapter DOM fragment.
function buildChapterDOM(chapters) {
  const container = document.createElement('div');
  for (const { title, time } of chapters) {
    const item = document.createElement('ytd-macro-markers-list-item-renderer');

    const tsEl = document.createElement('span');
    tsEl.className = 'time-string';
    tsEl.textContent = time;

    const titleEl = document.createElement('h4');
    titleEl.className = 'yt-simple-endpoint';
    titleEl.textContent = title;

    item.appendChild(tsEl);
    item.appendChild(titleEl);
    container.appendChild(item);
  }
  return container;
}

const FIVE_CHAPTERS = [
  { title: 'Intro', time: '0:00' },
  { title: 'Setup', time: '1:30' },
  { title: 'Main Topic', time: '5:45' },
  { title: 'Deep Dive', time: '12:10' },
  { title: 'Outro', time: '20:00' },
];

describe('ChapterParser.parse()', () => {
  test('parses a normal list of 5 chapters', () => {
    const root = buildChapterDOM(FIVE_CHAPTERS);
    const result = parse(root);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ title: 'Intro', startSeconds: 0 });
    expect(result[1]).toEqual({ title: 'Setup', startSeconds: 90 });
    expect(result[2]).toEqual({ title: 'Main Topic', startSeconds: 345 });
    expect(result[3]).toEqual({ title: 'Deep Dive', startSeconds: 730 });
    expect(result[4]).toEqual({ title: 'Outro', startSeconds: 1200 });
  });

  test('returns null when fewer than 5 chapters are present', () => {
    const root = buildChapterDOM(FIVE_CHAPTERS.slice(0, 4));
    expect(parse(root)).toBeNull();
  });

  test('returns null when no chapters exist', () => {
    const root = buildChapterDOM([]);
    expect(parse(root)).toBeNull();
  });

  test('includes hour-long timestamps', () => {
    const chapters = [
      ...FIVE_CHAPTERS,
      { title: 'Bonus', time: '1:02:03' },
    ];
    const root = buildChapterDOM(chapters);
    const result = parse(root);
    expect(result).toHaveLength(6);
    expect(result[5]).toEqual({ title: 'Bonus', startSeconds: 3723 });
  });
});

describe('ChapterParser.parseTimestamp()', () => {
  test('parses MM:SS', () => expect(parseTimestamp('1:30')).toBe(90));
  test('parses H:MM:SS', () => expect(parseTimestamp('1:02:03')).toBe(3723));
  test('parses 0:00', () => expect(parseTimestamp('0:00')).toBe(0));

  test('throws on non-numeric segment', () => {
    expect(() => parseTimestamp('1:xx')).toThrow('Malformed timestamp');
  });

  test('throws on single segment (no colon)', () => {
    expect(() => parseTimestamp('90')).toThrow('Malformed timestamp');
  });

  test('throws on empty string', () => {
    expect(() => parseTimestamp('')).toThrow('Malformed timestamp');
  });
});
