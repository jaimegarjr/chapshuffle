import type { Chapter } from '../types';
import type { QueueEndBehavior } from '../persistence/PersistenceManager';
import { PlaybackTimeline, type ShuffleFn } from './PlaybackTimeline';
import { createDebugLogger } from '../debug/DebugLogger';

const debug = createDebugLogger('playback');
const FINAL_VIDEO_CHAPTER_ADVANCE_BUFFER_SECONDS = 1;

export class PlaybackController {
  private readonly _video: HTMLVideoElement;
  private readonly _timeline: PlaybackTimeline;
  private _autoAdvance: boolean;
  private _queueEndBehavior: QueueEndBehavior;
  private _loopMode = false;
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
      debug.log(
        `mid-video resume - currentTime=${videoEl.currentTime.toFixed(2)}, ` +
          `chapter="${resumeChapter?.title ?? '?'}", currentIndex=${this._timeline.currentIndex}`
      );
    }
    videoEl.addEventListener('timeupdate', this._bound);

    debug.log(
      'initial queue:',
      this._timeline.queue.map((chapter, index) => {
        return `[${index}]${chapter.title}@${chapter.startSeconds}s`;
      })
    );
  }

  get currentIndex(): number {
    return this._timeline.currentIndex;
  }

  set autoAdvance(value: boolean) {
    this._autoAdvance = value;
    debug.log(`autoAdvance set to ${value}`);
  }

  set queueEndBehavior(value: QueueEndBehavior) {
    this._queueEndBehavior = value;
    debug.log(`queueEndBehavior set to ${value}`);
  }

  get loopMode(): boolean {
    return this._loopMode;
  }

  set loopMode(value: boolean) {
    this._loopMode = value;
    debug.log(`loopMode set to ${value}`);
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
    const previousTime = this._video.currentTime;
    this._seekTarget = chapter.startSeconds;
    this._suppressCount = 0;
    this._video.currentTime = this._seekTarget;
    debug.log(
      `seek -> [${index}] "${chapter.title}" start=${chapter.startSeconds}s` +
        ` end=${this._timeline.endSecondsFor(chapter)}s` +
        ` (was currentTime=${previousTime.toFixed(2)}, seekTarget=${this._seekTarget})`
    );
  }

  private _onTimeUpdate(): void {
    const currentTime = this._video.currentTime;

    if (this._seekTarget !== null) {
      const delta = Math.abs(currentTime - this._seekTarget);
      if (delta > 2) {
        if (this._suppressCount === 0) {
          debug.log(
            `timeupdate suppressed - currentTime=${currentTime.toFixed(2)}` +
              ` seekTarget=${this._seekTarget} delta=${delta.toFixed(2)}`
          );
        }
        this._suppressCount++;
        return;
      }

      const chapter = this._timeline.currentChapter;
      debug.log(
        `timeupdate settled after ${this._suppressCount} suppressed ticks - ` +
          `currentTime=${currentTime.toFixed(2)} seekTarget=${this._seekTarget} ` +
          `chapter="${chapter?.title ?? '?'}" end=${this._timeline.currentEndSeconds()}`
      );
      this._seekTarget = null;
      this._suppressCount = 0;
      return;
    }

    const endSeconds = this._currentQueueBoundarySeconds();
    if (currentTime < endSeconds) return;

    if (this._loopMode) {
      const chapter = this._timeline.currentChapter;
      if (chapter) {
        debug.log(`loop - seeking back to start of "${chapter.title}" at ${chapter.startSeconds}s`);
        this._seekTarget = chapter.startSeconds;
        this._suppressCount = 0;
        this._video.currentTime = chapter.startSeconds;
      }
      return;
    }

    if (!this._autoAdvance) return;

    if (this._timeline.isLastChapter) {
      debug.log(`queue end - behavior=${this._queueEndBehavior}`);
      if (this._queueEndBehavior === 'end-video') {
        const duration = this._video.duration;
        if (isFinite(duration)) this._video.currentTime = duration;
      } else {
        this.reshuffle();
      }
    } else {
      const nextIndex = this._timeline.currentIndex + 1;
      const chapter = this._timeline.currentChapter;
      const nextChapter = this._timeline.queue[nextIndex];
      debug.log(
        `auto-advance - currentTime=${currentTime.toFixed(2)} >= end=${endSeconds}` +
          ` "[${this._timeline.currentIndex}]${chapter?.title ?? '?'}" -> ` +
          `"[${nextIndex}]${nextChapter?.title ?? '?'}"`
      );
      this._seek(nextIndex);
    }
  }

  private _currentQueueBoundarySeconds(): number {
    const endSeconds = this._timeline.currentEndSeconds();
    if (isFinite(endSeconds) || this._timeline.isLastChapter) return endSeconds;

    const duration = this._video.duration;
    const chapter = this._timeline.currentChapter;
    if (!isFinite(duration) || !chapter) return endSeconds;

    return Math.max(chapter.startSeconds, duration - FINAL_VIDEO_CHAPTER_ADVANCE_BUFFER_SECONDS);
  }

  seekToChapter(index: number): void {
    debug.log(`seekToChapter(${index}) called`);
    this._seek(index);
  }

  reshuffle(): void {
    const chapter = this._timeline.reshuffle();
    if (!chapter) return;
    debug.log(
      'reshuffle - new queue:',
      this._timeline.queue.map((queueChapter, index) => {
        return `[${index}]${queueChapter.title}@${queueChapter.startSeconds}s`;
      })
    );
    this._seek(0);
  }

  reorderQueue(fromIndex: number, toIndex: number): boolean {
    const didReorder = this._timeline.moveQueueItem(fromIndex, toIndex);
    if (didReorder) {
      debug.log(
        'reorder queue:',
        this._timeline.queue.map((queueChapter, index) => {
          return `[${index}]${queueChapter.title}@${queueChapter.startSeconds}s`;
        })
      );
    }
    return didReorder;
  }

  setExcluded(excluded: Set<number>): void {
    this._timeline.setExcluded(excluded);
  }

  dropFromQueue(startSeconds: number): void {
    this._timeline.dropFromQueue(startSeconds);
  }

  destroy(): void {
    this._video.removeEventListener('timeupdate', this._bound);
  }
}
