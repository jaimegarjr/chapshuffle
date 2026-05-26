import { PlaybackController } from '../src/playback/PlaybackController';
import type { Chapter } from '../src/types';

const identity = (arr: Chapter[]): Chapter[] => [...arr];

const CHAPTERS: Chapter[] = [
  { title: 'Intro', startSeconds: 0   },
  { title: 'Act 1', startSeconds: 60  },
  { title: 'Act 2', startSeconds: 120 },
  { title: 'Act 3', startSeconds: 180 },
  { title: 'Outro', startSeconds: 240 },
];

interface MockVideo {
  currentTime: number;
  addEventListener: (event: string, fn: () => void) => void;
  removeEventListener: (event: string, fn: () => void) => void;
  tick: (time: number) => void;
}

function buildMockVideo(initialTime = 0): MockVideo {
  const listeners: Record<string, Array<() => void>> = { timeupdate: [] };
  const video: MockVideo = {
    currentTime: initialTime,
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
    ctrl.seekToChapter(3); // Act 3 (180s), ends at 240s
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

  test('no-ops for negative index', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);
    ctrl.seekToChapter(-1);
    expect(ctrl.currentIndex).toBe(0);
    ctrl.destroy();
  });

  test('no-ops for out-of-range index', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);
    ctrl.seekToChapter(99);
    expect(ctrl.currentIndex).toBe(0);
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
