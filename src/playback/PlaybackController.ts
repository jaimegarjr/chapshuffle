import type { Chapter } from "../types";
import { shuffle as defaultShuffle } from "../shuffle/ShuffleEngine";

type ShuffleFn = (chapters: Chapter[]) => Chapter[];

export class PlaybackController {
  private readonly _video: HTMLVideoElement;
  private readonly _sorted: Chapter[];
  private readonly _shuffleFn: ShuffleFn;
  private _queue: Chapter[];
  private _currentIndex = 0;
  private readonly _bound: () => void;

  /**
   * @param videoEl - The video element to observe.
   * @param chapters - Original (unsorted) chapter list.
   * @param shuffleFn - Override for testing; defaults to ShuffleEngine.shuffle.
   */
  constructor(
    videoEl: HTMLVideoElement,
    chapters: Chapter[],
    shuffleFn?: ShuffleFn,
  ) {
    this._shuffleFn = shuffleFn ?? defaultShuffle;
    this._video = videoEl;
    this._sorted = [...chapters].sort(
      (a, b) => a.startSeconds - b.startSeconds,
    );
    this._queue = this._shuffleFn([...this._sorted]);
    this._bound = this._onTimeUpdate.bind(this);
    videoEl.addEventListener("timeupdate", this._bound);
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get queue(): Chapter[] {
    return [...this._queue];
  }

  // A chapter ends when currentTime reaches the next chapter's start in the
  // original sorted order, keeping boundaries video-accurate regardless of
  // shuffle order.
  private _endSecondsFor(chapter: Chapter): number {
    const i = this._sorted.findIndex(
      (c) => c.startSeconds === chapter.startSeconds,
    );
    return i >= 0 && i < this._sorted.length - 1
      ? this._sorted[i + 1].startSeconds
      : Infinity;
  }

  private _onTimeUpdate(): void {
    const chapter = this._queue[this._currentIndex];
    if (this._video.currentTime >= this._endSecondsFor(chapter)) {
      this._currentIndex = (this._currentIndex + 1) % this._queue.length;
      this._video.currentTime = this._queue[this._currentIndex].startSeconds;
    }
  }

  /** Seeks to a specific chapter in the shuffled queue by index. No-ops for out-of-range. */
  seekToChapter(index: number): void {
    if (index < 0 || index >= this._queue.length) return;
    this._currentIndex = index;
    this._video.currentTime = this._queue[index].startSeconds;
  }

  /** Generates a fresh shuffle order and restarts playback from queue index 0. */
  reshuffle(): void {
    this._queue = this._shuffleFn([...this._sorted]);
    this._currentIndex = 0;
    this._video.currentTime = this._queue[0].startSeconds;
  }

  /** Removes the timeupdate listener. Call when the video is unloaded. */
  destroy(): void {
    this._video.removeEventListener("timeupdate", this._bound);
  }
}
