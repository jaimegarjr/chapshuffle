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
    ctrl.seekToChapter(3); // Act 3 (180s), ends at 240s
    video.tick(180);        // seek settled
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

describe('PlaybackController — seek race condition', () => {
  // Reproduces the "Inside the Deku Tree" bug: clicking a chapter that ends
  // at T2 while currentTime is already at T2 (stale pre-seek value) must NOT
  // immediately advance to the next chapter.
  test('stale pre-seek timeupdate does not advance past the target chapter', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);

    // Simulate being at the boundary of Act 2 (currentTime = 180, end of Act 2).
    ctrl.seekToChapter(2); // seek to Act 2 (120s), settle the seek
    video.tick(120);        // seek settled

    // Now seek to Act 1 (60s, ends at 120s) while currentTime is still 120.
    // A stale timeupdate with currentTime = 120 must not advance past Act 1.
    ctrl.seekToChapter(1);  // _seekTarget = 60
    video.tick(180);        // stale: currentTime is still far from target → suppressed
    expect(ctrl.currentIndex).toBe(1); // still on Act 1, NOT advanced

    video.tick(60);         // seek settled at target
    expect(ctrl.currentIndex).toBe(1); // still on Act 1

    video.tick(119);        // playing through Act 1, not at boundary yet
    expect(ctrl.currentIndex).toBe(1);

    video.tick(120);        // boundary crossed naturally → advance
    expect(ctrl.currentIndex).toBe(2);
    ctrl.destroy();
  });

  test('browser seek overshoots past end of short chapter — does not immediately advance', () => {
    const SHORT_CHAPTERS: Chapter[] = [
      { title: 'Intro', startSeconds: 0 },
      { title: 'Short', startSeconds: 60 }, // endSeconds = 61 (1-second chapter)
      { title: 'Following', startSeconds: 61 },
      { title: 'Act 3', startSeconds: 120 },
      { title: 'Outro', startSeconds: 180 },
    ];
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, SHORT_CHAPTERS, identity);

    ctrl.seekToChapter(1); // seek to Short (60s), endSeconds = 61
    // Browser overshoots: lands at 61.5 — within 2s of target (60s), but past end (61s).
    video.tick(61.5);       // settling tick — must NOT advance
    expect(ctrl.currentIndex).toBe(1);

    video.tick(60.5);       // normal playback tick inside the chapter
    expect(ctrl.currentIndex).toBe(1);

    video.tick(61);         // boundary crossed naturally → advance
    expect(ctrl.currentIndex).toBe(2);
    ctrl.destroy();
  });

  test('duplicate startSeconds (same YouTube timestamp) — chapter plays to next distinct boundary', () => {
    const DUP_CHAPTERS: Chapter[] = [
      { title: 'Before', startSeconds: 0 },
      { title: 'Deku Tree', startSeconds: 1014 },
      { title: 'Duplicate', startSeconds: 1014 }, // same offset as Deku Tree
      { title: 'After', startSeconds: 2000 },
      { title: 'Outro', startSeconds: 3000 },
    ];
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, DUP_CHAPTERS, identity);

    ctrl.seekToChapter(1); // seek to Deku Tree (1014s)
    video.tick(1014);       // settled — endSeconds must be 2000, NOT 1014
    expect(ctrl.currentIndex).toBe(1);

    video.tick(1015);       // inside Deku Tree
    expect(ctrl.currentIndex).toBe(1);

    video.tick(2000);       // boundary crossed naturally → advance
    expect(ctrl.currentIndex).toBe(2);
    ctrl.destroy();
  });

  test('reshuffle does not immediately skip the first chapter', () => {
    const video = buildMockVideo(0);
    let call = 0;
    // First shuffle: [Intro, Act1, Act2, Act3, Outro]
    // Second shuffle (reshuffle): reverse = [Outro, Act3, Act2, Act1, Intro]
    const shuffleFn = (arr: Chapter[]) => (++call === 1 ? [...arr] : [...arr].reverse());
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, shuffleFn);

    // Advance near end of the queue
    ctrl.seekToChapter(4); // Outro (240s, last chapter → end = Infinity)
    video.tick(240);        // settled

    // Reshuffle — new queue[0] = Outro (240s), seeks there.
    // currentTime is still 240 before seek settles, which must not trigger
    // an advance from Outro (whose end is still Infinity, so safe here —
    // but the guard also prevents any stale cross-chapter advances in general).
    ctrl.reshuffle();
    video.tick(240);        // stale tick at same time — should stay at index 0
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
    const ctrl = new PlaybackController(v as unknown as HTMLVideoElement, FIVE, sf, true, 'reshuffle');
    ctrl.seekToChapter(4); // A (0s), endSeconds = 60
    v.tick(0);  // settle
    v.tick(60); // A ends → last chapter → reshuffle → seek to index 0 (A, 0s)
    expect(ctrl.currentIndex).toBe(0);
    expect(v.currentTime).toBe(0);
    ctrl.destroy();
  });

  test('end-video: reaching end of queue seeks to video.duration', () => {
    // Queue reversed so last item (A, 0s) ends at 60s (finite boundary)
    const FIVE: Chapter[] = [
      { title: 'A', startSeconds: 0 },
      { title: 'B', startSeconds: 60 },
      { title: 'C', startSeconds: 120 },
      { title: 'D', startSeconds: 180 },
      { title: 'E', startSeconds: 240 },
    ];
    const reverse = (arr: Chapter[]) => [...arr].reverse();
    const v = buildMockVideo(0, 300);
    const ctrl = new PlaybackController(v as unknown as HTMLVideoElement, FIVE, reverse, true, 'end-video');
    // Queue: [E,D,C,B,A]. Last = A (index 4), ends at 60.
    ctrl.seekToChapter(4);
    v.tick(0);  // settle
    v.tick(60); // A ends → last chapter → seek to video.duration
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
    const v = buildMockVideo(0, Infinity); // livestream
    const ctrl = new PlaybackController(v as unknown as HTMLVideoElement, FIVE, reverse, true, 'end-video');
    ctrl.seekToChapter(4); // A (0s), ends at 60
    v.tick(0);
    v.tick(60); // end of last chapter — should NOT seek
    expect(v.currentTime).toBe(60); // unchanged
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
    // Start with reshuffle, switch to end-video before queue ends
    const ctrl = new PlaybackController(v as unknown as HTMLVideoElement, FIVE, reverse, true, 'reshuffle');
    ctrl.seekToChapter(4); // A (0s), ends at 60
    v.tick(0);
    ctrl.queueEndBehavior = 'end-video'; // switch mid-playback
    v.tick(60); // end of last chapter → should end-video, not reshuffle
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

// ── chapterProgress ────────────────────────────────────────────────────────

describe('PlaybackController — chapterProgress', () => {
  test('returns 0 when at the chapter start', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);
    // identity keeps original order; currentIndex=0 is Intro starting at 0s
    expect(ctrl.chapterProgress).toBe(0);
    ctrl.destroy();
  });

  test('returns correct ratio mid-chapter', () => {
    const video = buildMockVideo(30);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);
    // Intro: 0s–60s; at 30s => 0.5
    expect(ctrl.chapterProgress).toBeCloseTo(0.5);
    ctrl.destroy();
  });

  test('clamps to 1 when at or past chapter end', () => {
    const video = buildMockVideo(0);
    // autoAdvance=false so _currentIndex stays at 0 (Intro) even when time passes its boundary.
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity, false);
    video.tick(65); // Intro ends at 60s; ratio = 65/60 > 1, clamped to 1
    expect(ctrl.chapterProgress).toBe(1);
    ctrl.destroy();
  });

  test('reflects updated currentTime after video ticks', () => {
    const video = buildMockVideo(0);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity, false);
    video.tick(30);
    // Intro: 0s–60s; at 30s => 0.5
    expect(ctrl.chapterProgress).toBeCloseTo(0.5);
    ctrl.destroy();
  });

  test('uses video.duration as end for the last chapter', () => {
    // duration=300; Outro starts at 240s; at 270s => (270-240)/(300-240) = 0.5
    const video = buildMockVideo(0, 300);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);
    ctrl.seekToChapter(4); // Outro is last in identity order, seeked to 240s
    video.currentTime = 270; // simulate playback mid-chapter
    expect(ctrl.chapterProgress).toBeCloseTo(0.5);
    ctrl.destroy();
  });

  test('returns 0 for last chapter when video.duration is not finite (livestream)', () => {
    const video = buildMockVideo(270, Infinity);
    const ctrl = new PlaybackController(video as unknown as HTMLVideoElement, CHAPTERS, identity);
    ctrl.seekToChapter(4);
    expect(ctrl.chapterProgress).toBe(0);
    ctrl.destroy();
  });
});
