import type { Chapter } from '../types';
import { shuffle as defaultShuffle } from '../shuffle/ShuffleEngine';

type ShuffleFn = (chapters: Chapter[]) => Chapter[];

export class PlaybackController {
  private readonly _video: HTMLVideoElement;
  private readonly _sorted: Chapter[];
  private readonly _shuffleFn: ShuffleFn;
  private _queue: Chapter[];
  private _currentIndex = 0;
  private readonly _bound: () => void;
  // Tracks the target currentTime after any programmatic seek. While set,
  // timeupdate advances are suppressed until the browser's playhead settles
  // within 2 s of the target — preventing stale pre-seek currentTime values
  // from falsely triggering an immediate chapter advance.
  private _seekTarget: number | null = null;

  constructor(videoEl: HTMLVideoElement, chapters: Chapter[], shuffleFn?: ShuffleFn) {
    this._shuffleFn = shuffleFn ?? defaultShuffle;
    this._video = videoEl;
    this._sorted = [...chapters].sort((a, b) => a.startSeconds - b.startSeconds);
    this._queue = this._shuffleFn([...this._sorted]);
    this._bound = this._onTimeUpdate.bind(this);
    videoEl.addEventListener('timeupdate', this._bound);
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get queue(): Chapter[] {
    return [...this._queue];
  }

  private _endSecondsFor(chapter: Chapter): number {
    const i = this._sorted.findIndex((c) => c.startSeconds === chapter.startSeconds);
    return i >= 0 && i < this._sorted.length - 1
      ? this._sorted[i + 1].startSeconds
      : Infinity;
  }

  private _seek(index: number): void {
    this._currentIndex = index;
    this._seekTarget = this._queue[index].startSeconds;
    this._video.currentTime = this._seekTarget;
  }

  private _onTimeUpdate(): void {
    const currentTime = this._video.currentTime;

    // Suppress advances while the browser hasn't yet moved the playhead to
    // the seek target. A stale currentTime from before the seek would
    // otherwise satisfy the boundary check and immediately skip the chapter.
    if (this._seekTarget !== null) {
      if (Math.abs(currentTime - this._seekTarget) > 2) return;
      this._seekTarget = null; // playhead has landed — resume normal tracking
    }

    const chapter = this._queue[this._currentIndex];
    if (currentTime >= this._endSecondsFor(chapter)) {
      this._seek((this._currentIndex + 1) % this._queue.length);
    }
  }

  /** Seeks to a specific chapter in the shuffled queue by index. No-ops for out-of-range. */
  seekToChapter(index: number): void {
    if (index < 0 || index >= this._queue.length) return;
    this._seek(index);
  }

  /** Generates a fresh shuffle order and restarts playback from queue index 0. */
  reshuffle(): void {
    this._queue = this._shuffleFn([...this._sorted]);
    this._seek(0);
  }

  /** Removes the timeupdate listener. Call when the video is unloaded. */
  destroy(): void {
    this._video.removeEventListener('timeupdate', this._bound);
  }
}
