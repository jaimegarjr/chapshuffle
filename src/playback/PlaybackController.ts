import type { Chapter } from '../types';
import type { QueueEndBehavior } from '../persistence/PersistenceManager';
import { PlaybackTimeline, type ShuffleFn } from './PlaybackTimeline';

declare const __DEV__: boolean;
function dbg(...args: unknown[]): void {
  if (__DEV__) console.debug('[ChapShuffle]', ...args);
}

export class PlaybackController {
  private readonly _video: HTMLVideoElement;
  private readonly _timeline: PlaybackTimeline;
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
    this._autoAdvance = autoAdvance;
    this._queueEndBehavior = queueEndBehavior;
    this._video = videoEl;
    this._timeline = new PlaybackTimeline(chapters, shuffleFn);
    this._bound = this._onTimeUpdate.bind(this);
    if (videoEl.currentTime > 0) {
      this._seekTarget = videoEl.currentTime;
      const resumeChapter = this._timeline.resumeAt(videoEl.currentTime);
      dbg(
        `mid-video resume — currentTime=${videoEl.currentTime.toFixed(2)}, ` +
          `chapter="${resumeChapter?.title ?? '?'}", _currentIndex=${this._timeline.currentIndex}`
      );
    }
    videoEl.addEventListener('timeupdate', this._bound);

    dbg(
      'initial queue:',
      this._timeline.queue.map((c, i) => `[${i}]${c.title}@${c.startSeconds}s`).join(', ')
    );
  }

  get currentIndex(): number {
    return this._timeline.currentIndex;
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
    return this._timeline.queue;
  }

  get chapterProgress(): number {
    return this._timeline.progressAt(this._video.currentTime, this._video.duration);
  }

  private _seek(index: number): void {
    const chapter = this._timeline.seekToIndex(index);
    if (!chapter) return;
    const prevTime = this._video.currentTime;
    this._seekTarget = chapter.startSeconds;
    this._suppressCount = 0;
    this._video.currentTime = this._seekTarget;
    dbg(
      `seek -> [${index}] "${chapter.title}" start=${chapter.startSeconds}s` +
        ` end=${this._timeline.endSecondsFor(chapter)}s` +
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

      const chapter = this._timeline.currentChapter;
      dbg(
        `timeupdate settled after ${this._suppressCount} suppressed ticks - ` +
          `currentTime=${currentTime.toFixed(2)} _seekTarget=${this._seekTarget} ` +
          `chapter="${chapter?.title ?? '?'}" end=${this._timeline.currentEndSeconds()}`
      );
      this._seekTarget = null;
      this._suppressCount = 0;
      return;
    }

    if (!this._autoAdvance) return;

    const chapter = this._timeline.currentChapter;
    const endSeconds = this._timeline.currentEndSeconds();
    if (currentTime >= endSeconds) {
      if (this._timeline.isLastChapter) {
        dbg(`queue end - behavior=${this._queueEndBehavior}`);
        if (this._queueEndBehavior === 'end-video') {
          const duration = this._video.duration;
          if (isFinite(duration)) this._video.currentTime = duration;
        } else {
          this.reshuffle();
        }
      } else {
        const nextIndex = this._timeline.currentIndex + 1;
        const nextChapter = this._timeline.queue[nextIndex];
        dbg(
          `auto-advance - currentTime=${currentTime.toFixed(2)} >= end=${endSeconds}` +
            ` "[${this._timeline.currentIndex}]${chapter?.title ?? '?'}" -> ` +
            `"[${nextIndex}]${nextChapter?.title ?? '?'}"`
        );
        this._seek(nextIndex);
      }
    }
  }

  seekToChapter(index: number): void {
    dbg(`seekToChapter(${index}) called`);
    this._seek(index);
  }

  reshuffle(): void {
    const chapter = this._timeline.reshuffle();
    if (!chapter) return;
    dbg(
      'reshuffle - new queue:',
      this._timeline.queue.map((c, i) => `[${i}]${c.title}@${c.startSeconds}s`).join(', ')
    );
    this._seek(0);
  }

  destroy(): void {
    this._video.removeEventListener('timeupdate', this._bound);
  }
}
