import { PlaybackController } from '../src/playback/PlaybackController';
import type { Chapter } from '../src/types';

const identity = (arr: Chapter[]): Chapter[] => [...arr];

const CHAPTERS: Chapter[] = [
  { title: 'Intro', startSeconds: 0 },
  { title: 'Act 1', startSeconds: 60 },
  { title: 'Act 2', startSeconds: 120 },
  { title: 'Act 3', startSeconds: 180 },
  { title: 'Outro', startSeconds: 240 },
];

interface MockVideo {
  currentTime: number;
  duration: number;
  addEventListener: (event: string, fn: () => void) => void;
  removeEventListener: (event: string, fn: () => void) => void;
  tick: (time: number) => void;
}

function buildMockVideo(initialTime = 0, duration = 300): MockVideo {
  const listeners: Record<string, Array<() => void>> = { timeupdate: [] };
  const video: MockVideo = {
    currentTime: initialTime,
    duration,
    addEventListener(event, fn) {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((f) => f !== fn);
      }
    },
    tick(time: number) {
      video.currentTime = time;
      listeners['timeupdate']?.forEach((fn) => fn());
    },
  };
  return video;
}

describe('PlaybackController — auto-advance', () => {
  test('advances to next chapter when boundary is crossed', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);
    video.tick(59);
    expect(ctrl.currentIndex).toBe(0);
    video.tick(60);
    expect(ctrl.currentIndex).toBe(1);
    expect(video.currentTime).toBe(60);
    ctrl.destroy();
  });

  test('wrap-around: advances to next after last finite-boundary chapter', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);
    ctrl.seekToChapter(3);
    video.tick(180);
    video.tick(241);
    expect(ctrl.currentIndex).toBe(4);
    ctrl.destroy();
  });
});

describe('PlaybackController — seekToChapter()', () => {
  test('seeks video to the chapter start and updates index', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);
    ctrl.seekToChapter(2);
    expect(ctrl.currentIndex).toBe(2);
    expect(video.currentTime).toBe(120);
    ctrl.destroy();
  });
});

describe('PlaybackController — reshuffle()', () => {
  test('generates a new queue and resets to index 0', () => {
    const video = buildMockVideo(0);
    let callCount = 0;
    const shuffleFn = (arr: Chapter[]) => {
      callCount++;
      return callCount === 1 ? [...arr] : [...arr].reverse();
    };
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, shuffleFn);
    const firstQueue = ctrl.queue;
    ctrl.seekToChapter(3);
    ctrl.reshuffle();
    expect(ctrl.currentIndex).toBe(0);
    expect(ctrl.queue).not.toEqual(firstQueue);
    expect(video.currentTime).toBe(ctrl.queue[0].startSeconds);
    ctrl.destroy();
  });
});

describe('PlaybackController — seek race condition', () => {
  test('stale pre-seek timeupdate does not advance past the target chapter', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);

    ctrl.seekToChapter(2);
    video.tick(120);

    ctrl.seekToChapter(1);
    video.tick(180);
    expect(ctrl.currentIndex).toBe(1);

    video.tick(60);
    expect(ctrl.currentIndex).toBe(1);

    video.tick(119);
    expect(ctrl.currentIndex).toBe(1);

    video.tick(120);
    expect(ctrl.currentIndex).toBe(2);
    ctrl.destroy();
  });

  test('browser seek overshoots past end of short chapter — does not immediately advance', () => {
    const SHORT_CHAPTERS: Chapter[] = [
      { title: 'Intro', startSeconds: 0 },
      { title: 'Short', startSeconds: 60 },
      { title: 'Following', startSeconds: 61 },
      { title: 'Act 3', startSeconds: 120 },
      { title: 'Outro', startSeconds: 180 },
    ];
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(
      video as unknown as HTMLVideoElement,
      SHORT_CHAPTERS,
      identity
    );

    ctrl.seekToChapter(1);
    video.tick(61.5);
    expect(ctrl.currentIndex).toBe(1);

    video.tick(60.5);
    expect(ctrl.currentIndex).toBe(1);

    video.tick(61);
    expect(ctrl.currentIndex).toBe(2);
    ctrl.destroy();
  });

  test('reshuffle does not immediately skip the first chapter', () => {
    const video = buildMockVideo(0);
    let call = 0;
    const shuffleFn = (arr: Chapter[]) => (++call === 1 ? [...arr] : [...arr].reverse());
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, shuffleFn);

    ctrl.seekToChapter(4);
    video.tick(240);

    ctrl.reshuffle();
    video.tick(240);
    expect(ctrl.currentIndex).toBe(0);
    ctrl.destroy();
  });
});

describe('PlaybackController — queue end behavior', () => {
  test('reshuffle: reaching end of queue generates new queue and restarts from index 0', () => {
    const FIVE: Chapter[] = [
      { title: 'A', startSeconds: 0 },
      { title: 'B', startSeconds: 60 },
      { title: 'C', startSeconds: 120 },
      { title: 'D', startSeconds: 180 },
      { title: 'E', startSeconds: 240 },
    ];
    let call = 0;
    const sf = (arr: Chapter[]) => (++call === 1 ? [...arr].reverse() : [...arr]);
    const v = buildMockVideo(0);
    const ctrl = new PlaybackController(
      v as unknown as HTMLVideoElement,
      FIVE,
      sf,
      true,
      'reshuffle'
    );
    ctrl.seekToChapter(4);
    v.tick(0);
    v.tick(60);
    expect(ctrl.currentIndex).toBe(0);
    expect(v.currentTime).toBe(0);
    ctrl.destroy();
  });

  test('end-video: reaching end of queue seeks to video.duration', () => {
    const FIVE: Chapter[] = [
      { title: 'A', startSeconds: 0 },
      { title: 'B', startSeconds: 60 },
      { title: 'C', startSeconds: 120 },
      { title: 'D', startSeconds: 180 },
      { title: 'E', startSeconds: 240 },
    ];
    const reverse = (arr: Chapter[]) => [...arr].reverse();
    const v = buildMockVideo(0, 300);
    const ctrl = new PlaybackController(
      v as unknown as HTMLVideoElement,
      FIVE,
      reverse,
      true,
      'end-video'
    );
    ctrl.seekToChapter(4);
    v.tick(0);
    v.tick(60);
    expect(v.currentTime).toBe(300);
    ctrl.destroy();
  });

  test('end-video: does not seek when video.duration is Infinity (livestream guard)', () => {
    const FIVE: Chapter[] = [
      { title: 'A', startSeconds: 0 },
      { title: 'B', startSeconds: 60 },
      { title: 'C', startSeconds: 120 },
      { title: 'D', startSeconds: 180 },
      { title: 'E', startSeconds: 240 },
    ];
    const reverse = (arr: Chapter[]) => [...arr].reverse();
    const v = buildMockVideo(0, Infinity);
    const ctrl = new PlaybackController(
      v as unknown as HTMLVideoElement,
      FIVE,
      reverse,
      true,
      'end-video'
    );
    ctrl.seekToChapter(4);
    v.tick(0);
    v.tick(60);
    expect(v.currentTime).toBe(60);
    ctrl.destroy();
  });

  test('queueEndBehavior setter takes effect before queue end fires', () => {
    const FIVE: Chapter[] = [
      { title: 'A', startSeconds: 0 },
      { title: 'B', startSeconds: 60 },
      { title: 'C', startSeconds: 120 },
      { title: 'D', startSeconds: 180 },
      { title: 'E', startSeconds: 240 },
    ];
    const reverse = (arr: Chapter[]) => [...arr].reverse();
    const v = buildMockVideo(0, 300);
    const ctrl = new PlaybackController(
      v as unknown as HTMLVideoElement,
      FIVE,
      reverse,
      true,
      'reshuffle'
    );
    ctrl.seekToChapter(4);
    v.tick(0);
    ctrl.queueEndBehavior = 'end-video';
    v.tick(60);
    expect(v.currentTime).toBe(300);
    ctrl.destroy();
  });
});

describe('PlaybackController — isolation', () => {
  test('two controllers for different videos do not share state', () => {
    const v1 = buildMockVideo(0);
    const v2 = buildMockVideo(0);
    const ctrl1 = new PlaybackController(v1 as unknown as HTMLVideoElement, CHAPTERS, identity);
    const ctrl2 = new PlaybackController(v2 as unknown as HTMLVideoElement, CHAPTERS, identity);
    ctrl1.seekToChapter(2);
    expect(ctrl2.currentIndex).toBe(0);
    ctrl1.destroy();
    ctrl2.destroy();
  });
});

describe('PlaybackController — chapterProgress', () => {
  test('reflects video currentTime through the active chapter', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(
      video as unknown as HTMLVideoElement,
      CHAPTERS,
      identity,
      false
    );
    video.tick(30);
    expect(ctrl.chapterProgress).toBeCloseTo(0.5);
    ctrl.destroy();
  });
});
