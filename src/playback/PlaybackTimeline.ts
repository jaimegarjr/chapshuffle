import type { Chapter } from '../types';
import { shuffle as defaultShuffle } from '../shuffle/ShuffleEngine';

export type ShuffleFn = (chapters: Chapter[]) => Chapter[];

export class PlaybackTimeline {
  private readonly _sorted: Chapter[];
  private readonly _shuffleFn: ShuffleFn;
  private _queue: Chapter[];
  private _currentIndex = 0;

  constructor(chapters: Chapter[], shuffleFn: ShuffleFn = defaultShuffle) {
    this._shuffleFn = shuffleFn;
    this._sorted = [...chapters].sort((a, b) => a.startSeconds - b.startSeconds);
    this._queue = this._shuffleFn([...this._sorted]);
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get currentChapter(): Chapter | null {
    return this._queue[this._currentIndex] ?? null;
  }

  get isLastChapter(): boolean {
    return this._currentIndex === this._queue.length - 1;
  }

  get queue(): Chapter[] {
    return [...this._queue];
  }

  seekToIndex(index: number): Chapter | null {
    if (index < 0 || index >= this._queue.length) return null;
    this._currentIndex = index;
    return this._queue[index];
  }

  reshuffle(): Chapter | null {
    this._queue = this._shuffleFn([...this._sorted]);
    this._currentIndex = 0;
    return this.currentChapter;
  }

  moveQueueItem(fromIndex: number, toIndex: number): boolean {
    if (
      fromIndex < 0 ||
      fromIndex >= this._queue.length ||
      toIndex < 0 ||
      toIndex >= this._queue.length
    ) {
      return false;
    }
    if (fromIndex === toIndex) return true;

    const currentChapter = this.currentChapter;
    const nextQueue = [...this._queue];
    const [moved] = nextQueue.splice(fromIndex, 1);
    nextQueue.splice(toIndex, 0, moved);
    this._queue = nextQueue;

    if (currentChapter) {
      const nextCurrentIndex = this._queue.indexOf(currentChapter);
      if (nextCurrentIndex >= 0) this._currentIndex = nextCurrentIndex;
    }

    return true;
  }

  resumeAt(currentTime: number): Chapter | null {
    let resumeChapter = this._sorted[0];
    for (const chapter of this._sorted) {
      if (chapter.startSeconds <= currentTime) resumeChapter = chapter;
      else break;
    }
    if (!resumeChapter) return null;

    const queueIndex = this._queue.findIndex(
      (chapter) => chapter.startSeconds === resumeChapter.startSeconds
    );
    if (queueIndex >= 0) {
      this._queue = [...this._queue.slice(queueIndex), ...this._queue.slice(0, queueIndex)];
      this._currentIndex = 0;
    }
    return resumeChapter;
  }

  currentEndSeconds(): number {
    const chapter = this.currentChapter;
    return chapter ? this.endSecondsFor(chapter) : Infinity;
  }

  endSecondsFor(chapter: Chapter): number {
    const index = this._sorted.findIndex(
      (candidate) => candidate.startSeconds === chapter.startSeconds
    );
    if (index < 0) return Infinity;

    for (let i = index + 1; i < this._sorted.length; i++) {
      if (this._sorted[i].startSeconds > chapter.startSeconds) {
        return this._sorted[i].startSeconds;
      }
    }
    return Infinity;
  }

  progressAt(currentTime: number, duration: number): number {
    const chapter = this.currentChapter;
    if (!chapter) return 0;

    const startSeconds = chapter.startSeconds;
    let endSeconds = this.endSecondsFor(chapter);
    if (!isFinite(endSeconds)) endSeconds = duration;
    if (!isFinite(endSeconds) || endSeconds <= startSeconds) return 0;

    const ratio = (currentTime - startSeconds) / (endSeconds - startSeconds);
    return Math.min(1, Math.max(0, ratio));
  }
}
