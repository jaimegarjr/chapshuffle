import type { Chapter } from '../types';
import { shuffle as defaultShuffle } from '../shuffle/ShuffleEngine';
import type { QueueEndBehavior } from '../persistence/PersistenceManager';

type ShuffleFn = (chapters: Chapter[]) => Chapter[];

declare const __DEV__: boolean;
function dbg(...args: unknown[]): void {
  if (__DEV__) console.debug('[ChapShuffle]', ...args);
}

export class PlaybackController {
  private readonly _video: HTMLVideoElement;
  private readonly _sorted: Chapter[];
  private readonly _shuffleFn: ShuffleFn;
  private _queue: Chapter[];
  private _currentIndex = 0;
  private _autoAdvance: boolean;
  private _queueEndBehavior: QueueEndBehavior;
  private readonly _bound: () => void;
  private _seekTarget: number | null = null;
  private _suppressCount = 0;

  constructor(
    videoEl: HTMLVideoElement,
    chapters: Chapter[],
    shuffleFn?: ShuffleFn,
    autoAdvance = true,
    queueEndBehavior: QueueEndBehavior = 'reshuffle'
  ) {
    this._shuffleFn = shuffleFn ?? defaultShuffle;
    this._autoAdvance = autoAdvance;
    this._queueEndBehavior = queueEndBehavior;
    this._video = videoEl;
    this._sorted = [...chapters].sort((a, b) => a.startSeconds - b.startSeconds);
    this._queue = this._shuffleFn([...this._sorted]);
    this._bound = this._onTimeUpdate.bind(this);
    if (videoEl.currentTime > 0) {
      this._seekTarget = videoEl.currentTime;
      let resumeChapter = this._sorted[0];
      for (const c of this._sorted) {
        if (c.startSeconds <= videoEl.currentTime) resumeChapter = c;
        else break;
      }
      const queueIdx = this._queue.findIndex((c) => c.startSeconds === resumeChapter.startSeconds);
      if (queueIdx >= 0) this._currentIndex = queueIdx;
      dbg(
        `mid-video resume — currentTime=${videoEl.currentTime.toFixed(2)}, ` +
          `chapter="${resumeChapter.title}", _currentIndex=${this._currentIndex}`
      );
    }
    videoEl.addEventListener('timeupdate', this._bound);

    dbg('created - sorted:', this._sorted.map((c) => `${c.title}@${c.startSeconds}s`).join(', '));
    dbg(
      'initial queue:',
      this._queue.map((c, i) => `[${i}]${c.title}@${c.startSeconds}s`).join(', ')
    );
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  set autoAdvance(value: boolean) {
    this._autoAdvance = value;
    dbg(`autoAdvance set to ${value}`);
  }

  set queueEndBehavior(value: QueueEndBehavior) {
    this._queueEndBehavior = value;
    dbg(`queueEndBehavior set to ${value}`);
  }

  get queue(): Chapter[] {
    return [...this._queue];
  }

  get chapterProgress(): number {
    const chapter = this._queue[this._currentIndex];
    const startSeconds = chapter.startSeconds;
    let endSeconds = this._endSecondsFor(chapter);
    if (!isFinite(endSeconds)) endSeconds = this._video.duration;
    if (!isFinite(endSeconds) || endSeconds <= startSeconds) return 0;
    const ratio = (this._video.currentTime - startSeconds) / (endSeconds - startSeconds);
    return Math.min(1, Math.max(0, ratio));
  }

  private _endSecondsFor(chapter: Chapter): number {
    const i = this._sorted.findIndex((c) => c.startSeconds === chapter.startSeconds);
    if (i < 0) {
      dbg(`WARN: chapter "${chapter.title}" (${chapter.startSeconds}s) not found in _sorted`);
      return Infinity;
    }
    for (let j = i + 1; j < this._sorted.length; j++) {
      if (this._sorted[j].startSeconds > chapter.startSeconds) {
        return this._sorted[j].startSeconds;
      }
    }
    return Infinity;
  }

  private _seek(index: number): void {
    const chapter = this._queue[index];
    const prevTime = this._video.currentTime;
    this._currentIndex = index;
    this._seekTarget = chapter.startSeconds;
    this._suppressCount = 0;
    this._video.currentTime = this._seekTarget;
    dbg(
      `seek -> [${index}] "${chapter.title}" start=${chapter.startSeconds}s` +
        ` end=${this._endSecondsFor(chapter)}s` +
        ` (was currentTime=${prevTime.toFixed(2)}, _seekTarget=${this._seekTarget})`
    );
  }

  private _onTimeUpdate(): void {
    const currentTime = this._video.currentTime;

    if (this._seekTarget !== null) {
      const delta = Math.abs(currentTime - this._seekTarget);
      if (delta > 2) {
        if (this._suppressCount === 0) {
          dbg(
            `timeupdate suppressed - currentTime=${currentTime.toFixed(2)}` +
              ` _seekTarget=${this._seekTarget} delta=${delta.toFixed(2)}`
          );
        }
        this._suppressCount++;
        return;
      }

      const chapter = this._queue[this._currentIndex];
      dbg(
        `timeupdate settled after ${this._suppressCount} suppressed ticks - ` +
          `currentTime=${currentTime.toFixed(2)} _seekTarget=${this._seekTarget} ` +
          `chapter="${chapter.title}" end=${this._endSecondsFor(chapter)}`
      );
      this._seekTarget = null;
      this._suppressCount = 0;
      return;
    }

    if (!this._autoAdvance) return;

    const chapter = this._queue[this._currentIndex];
    const endSeconds = this._endSecondsFor(chapter);
    if (currentTime >= endSeconds) {
      const isLastChapter = this._currentIndex === this._queue.length - 1;
      if (isLastChapter) {
        dbg(`queue end - behavior=${this._queueEndBehavior}`);
        if (this._queueEndBehavior === 'end-video') {
          const duration = this._video.duration;
          if (isFinite(duration)) this._video.currentTime = duration;
        } else {
          this.reshuffle();
        }
      } else {
        const nextIndex = this._currentIndex + 1;
        dbg(
          `auto-advance - currentTime=${currentTime.toFixed(2)} >= end=${endSeconds}` +
            ` "[${this._currentIndex}]${chapter.title}" -> ` +
            `"[${nextIndex}]${this._queue[nextIndex].title}"`
        );
        this._seek(nextIndex);
      }
    }
  }

  seekToChapter(index: number): void {
    if (index < 0 || index >= this._queue.length) return;
    dbg(`seekToChapter(${index}) called - queue[${index}]="${this._queue[index].title}"`);
    this._seek(index);
  }

  reshuffle(): void {
    this._queue = this._shuffleFn([...this._sorted]);
    dbg(
      'reshuffle - new queue:',
      this._queue.map((c, i) => `[${i}]${c.title}@${c.startSeconds}s`).join(', ')
    );
    this._seek(0);
  }

  destroy(): void {
    this._video.removeEventListener('timeupdate', this._bound);
  }
}
