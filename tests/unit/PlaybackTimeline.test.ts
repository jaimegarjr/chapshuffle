import { PlaybackTimeline } from '../../src/playback/PlaybackTimeline';
import type { Chapter } from '../../src/types';

const identity = (arr: Chapter[]): Chapter[] => [...arr];

const CHAPTERS: Chapter[] = [
  { title: 'Intro', startSeconds: 0 },
  { title: 'Act 1', startSeconds: 60 },
  { title: 'Act 2', startSeconds: 120 },
  { title: 'Act 3', startSeconds: 180 },
  { title: 'Outro', startSeconds: 240 },
];

describe('PlaybackTimeline — queue state', () => {
  test('builds a shuffled queue without exposing mutable state', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);
    const queue = timeline.queue;
    queue.reverse();

    expect(timeline.queue).toEqual(CHAPTERS);
  });

  test('seeks to an in-range queue index', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);
    expect(timeline.seekToIndex(2)).toEqual({ title: 'Act 2', startSeconds: 120 });
    expect(timeline.currentIndex).toBe(2);
  });

  test('ignores out-of-range queue indexes', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);
    expect(timeline.seekToIndex(-1)).toBeNull();
    expect(timeline.seekToIndex(99)).toBeNull();
    expect(timeline.currentIndex).toBe(0);
  });

  test('reshuffles the queue and returns to index 0', () => {
    let callCount = 0;
    const shuffleFn = (arr: Chapter[]) => (++callCount === 1 ? [...arr] : [...arr].reverse());
    const timeline = new PlaybackTimeline(CHAPTERS, shuffleFn);
    const firstQueue = timeline.queue;

    timeline.seekToIndex(3);
    const current = timeline.reshuffle();

    expect(timeline.currentIndex).toBe(0);
    expect(timeline.queue).not.toEqual(firstQueue);
    expect(current).toEqual(timeline.queue[0]);
  });

  test('moves a queue item and keeps the same current chapter active', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);
    timeline.seekToIndex(2);

    expect(timeline.moveQueueItem(4, 1)).toBe(true);

    expect(timeline.queue.map((chapter) => chapter.title)).toEqual([
      'Intro',
      'Outro',
      'Act 1',
      'Act 2',
      'Act 3',
    ]);
    expect(timeline.currentChapter).toEqual({ title: 'Act 2', startSeconds: 120 });
    expect(timeline.currentIndex).toBe(3);
  });

  test('ignores queue moves with out-of-range indexes', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);
    const queue = timeline.queue;

    expect(timeline.moveQueueItem(-1, 2)).toBe(false);
    expect(timeline.moveQueueItem(1, 99)).toBe(false);

    expect(timeline.queue).toEqual(queue);
    expect(timeline.currentIndex).toBe(0);
  });

  test('resumes with the current video chapter first in the queue', () => {
    const shuffleFn = (arr: Chapter[]) => [arr[1], arr[2], arr[3], arr[4], arr[0]];
    const timeline = new PlaybackTimeline(CHAPTERS, shuffleFn);

    const resumed = timeline.resumeAt(210);

    expect(resumed).toEqual({ title: 'Act 3', startSeconds: 180 });
    expect(timeline.currentIndex).toBe(0);
    expect(timeline.queue).toEqual([
      { title: 'Act 3', startSeconds: 180 },
      { title: 'Outro', startSeconds: 240 },
      { title: 'Intro', startSeconds: 0 },
      { title: 'Act 1', startSeconds: 60 },
      { title: 'Act 2', startSeconds: 120 },
    ]);
  });
});

describe('PlaybackTimeline — chapter boundaries', () => {
  test('uses the next distinct timestamp as the chapter end', () => {
    const chapters: Chapter[] = [
      { title: 'Before', startSeconds: 0 },
      { title: 'Deku Tree', startSeconds: 1014 },
      { title: 'Duplicate', startSeconds: 1014 },
      { title: 'After', startSeconds: 2000 },
      { title: 'Outro', startSeconds: 3000 },
    ];
    const timeline = new PlaybackTimeline(chapters, identity);

    expect(timeline.endSecondsFor({ title: 'Deku Tree', startSeconds: 1014 })).toBe(2000);
    expect(timeline.endSecondsFor({ title: 'Duplicate', startSeconds: 1014 })).toBe(2000);
  });

  test('returns Infinity for the last chapter end', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);

    expect(timeline.endSecondsFor({ title: 'Outro', startSeconds: 240 })).toBe(Infinity);
  });
});

describe('PlaybackTimeline — progress', () => {
  test('returns progress through the current chapter', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);

    expect(timeline.progressAt(30, 300)).toBeCloseTo(0.5);
  });

  test('clamps progress before and after current chapter bounds', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);

    expect(timeline.progressAt(-10, 300)).toBe(0);
    expect(timeline.progressAt(65, 300)).toBe(1);
  });

  test('uses video duration as the final chapter end', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);
    timeline.seekToIndex(4);

    expect(timeline.progressAt(270, 300)).toBeCloseTo(0.5);
  });

  test('returns 0 for the final chapter when duration is not finite', () => {
    const timeline = new PlaybackTimeline(CHAPTERS, identity);
    timeline.seekToIndex(4);

    expect(timeline.progressAt(270, Infinity)).toBe(0);
  });
});
