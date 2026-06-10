import type { Chapter } from '../types';
import type { QueueEndBehavior } from '../persistence/PersistenceManager';
import { PlaybackController } from './PlaybackController';
import { getExclusions, setExclusions } from '../exclusion/ExclusionManager';

export interface SessionControllerOptions {
  video: HTMLVideoElement;
  chapters: Chapter[];
  videoId: string | null;
  autoAdvance: boolean;
  queueEndBehavior: QueueEndBehavior;
  onUpdate: () => void;
  onAnalyticsEvent?: (event: SessionAnalyticsEvent) => void;
}

export type SessionAnalyticsEvent =
  | {
      name: 'chapter_completed';
      params: { queue_position: number; queue_length: number };
    }
  | {
      name: 'chapter_skipped';
      params: { queue_position: number; target_position: number; queue_length: number };
    }
  | { name: 'reshuffle_used'; params: Record<string, never> }
  | { name: 'exclusions_updated'; params: { excluded_count: number } }
  | { name: 'loop_toggled'; params: { enabled: boolean } }
  | {
      name: 'queue_reordered';
      params: { from_position: number; to_position: number; queue_length: number };
    };

export interface SessionSnapshot {
  queue: Chapter[];
  allChapters: Chapter[];
  currentIndex: number;
  progress: number;
  loopMode: boolean;
  excludedSeconds: Set<number>;
}

export type SessionAction =
  | { type: 'seek'; index: number }
  | { type: 'previous' }
  | { type: 'next' }
  | { type: 'reshuffle' }
  | { type: 'toggle-loop' }
  | { type: 'reorder'; fromIndex: number; toIndex: number }
  | { type: 'apply-exclusions'; excludedSeconds: Set<number> };

export class SessionController {
  private readonly _controller: PlaybackController;
  private readonly _allChapters: Chapter[];
  private readonly _videoId: string | null;
  private _loopMode = false;
  private _excluded: Set<number> = new Set();
  private readonly _boundOnUpdate: () => void;
  private readonly _video: HTMLVideoElement;
  private readonly _onAnalyticsEvent: (event: SessionAnalyticsEvent) => void;

  static async create(options: SessionControllerOptions): Promise<SessionController> {
    let storedExclusions: number[] = [];
    if (options.videoId) {
      try {
        storedExclusions = await getExclusions(options.videoId);
      } catch {}
    }

    return new SessionController(
      options.video,
      options.chapters,
      options.videoId,
      options.autoAdvance,
      options.queueEndBehavior,
      options.onUpdate,
      new Set(storedExclusions),
      options.onAnalyticsEvent
    );
  }

  private constructor(
    video: HTMLVideoElement,
    chapters: Chapter[],
    videoId: string | null,
    autoAdvance: boolean,
    queueEndBehavior: QueueEndBehavior,
    onUpdate: () => void,
    initialExclusions: Set<number> = new Set(),
    onAnalyticsEvent: (event: SessionAnalyticsEvent) => void = () => {}
  ) {
    this._video = video;
    this._allChapters = chapters;
    this._videoId = videoId;
    this._controller = new PlaybackController(
      video,
      chapters,
      undefined,
      autoAdvance,
      queueEndBehavior,
      (queuePosition, queueLength) =>
        onAnalyticsEvent({
          name: 'chapter_completed',
          params: { queue_position: queuePosition, queue_length: queueLength },
        })
    );
    this._onAnalyticsEvent = onAnalyticsEvent;
    this._excluded = this._normalizeInitialExclusions(initialExclusions);
    this._controller.setExcluded(this._excluded);
    this._boundOnUpdate = onUpdate;
    video.addEventListener('timeupdate', this._boundOnUpdate);
  }

  get snapshot(): SessionSnapshot {
    return {
      queue: this._controller.queue,
      allChapters: this._allChapters,
      currentIndex: this._controller.currentIndex,
      progress: this._controller.chapterProgress,
      loopMode: this._loopMode,
      excludedSeconds: new Set(this._excluded),
    };
  }

  set autoAdvance(value: boolean) {
    this._controller.autoAdvance = value;
  }

  set queueEndBehavior(value: QueueEndBehavior) {
    this._controller.queueEndBehavior = value;
  }

  perform(action: SessionAction): void {
    switch (action.type) {
      case 'seek':
        this._skipTo(action.index);
        return;
      case 'previous':
        this._skipTo(this._controller.currentIndex - 1);
        return;
      case 'next':
        this._skipTo(this._controller.currentIndex + 1);
        return;
      case 'reshuffle':
        this._controller.reshuffle();
        this._onAnalyticsEvent({ name: 'reshuffle_used', params: {} });
        return;
      case 'toggle-loop':
        this._loopMode = !this._loopMode;
        this._controller.loopMode = this._loopMode;
        this._onAnalyticsEvent({
          name: 'loop_toggled',
          params: { enabled: this._loopMode },
        });
        return;
      case 'reorder':
        if (
          action.fromIndex !== action.toIndex &&
          this._controller.reorderQueue(action.fromIndex, action.toIndex)
        ) {
          this._onAnalyticsEvent({
            name: 'queue_reordered',
            params: {
              from_position: action.fromIndex + 1,
              to_position: action.toIndex + 1,
              queue_length: this._controller.queue.length,
            },
          });
        }
        return;
      case 'apply-exclusions':
        if (this._applyExclusions(action.excludedSeconds)) {
          this._onAnalyticsEvent({
            name: 'exclusions_updated',
            params: { excluded_count: this._excluded.size },
          });
        }
    }
  }

  private _skipTo(targetIndex: number): void {
    const currentIndex = this._controller.currentIndex;
    const queueLength = this._controller.queue.length;
    if (targetIndex < 0 || targetIndex >= queueLength || targetIndex === currentIndex) return;
    this._controller.seekToChapter(targetIndex);
    this._onAnalyticsEvent({
      name: 'chapter_skipped',
      params: {
        queue_position: currentIndex + 1,
        target_position: targetIndex + 1,
        queue_length: queueLength,
      },
    });
  }

  private _applyExclusions(nextExcluded: Set<number>): boolean {
    const normalized = this._knownExclusions(nextExcluded);
    if (this._allChapters.length > 0 && normalized.size >= this._allChapters.length) return false;
    if (
      normalized.size === this._excluded.size &&
      [...normalized].every((startSeconds) => this._excluded.has(startSeconds))
    ) {
      return false;
    }

    const toRestore = this._allChapters.filter(
      (c) => this._excluded.has(c.startSeconds) && !normalized.has(c.startSeconds)
    );

    this._excluded = normalized;
    this._controller.setExcluded(this._excluded);
    if (toRestore.length > 0) this._controller.appendToQueue(toRestore);

    if (this._videoId) {
      setExclusions(this._videoId, [...this._excluded]).catch(() => {});
    }
    return true;
  }

  private _knownExclusions(excluded: Set<number>): Set<number> {
    const knownStarts = new Set(this._allChapters.map((chapter) => chapter.startSeconds));
    return new Set([...excluded].filter((startSeconds) => knownStarts.has(startSeconds)));
  }

  private _normalizeInitialExclusions(excluded: Set<number>): Set<number> {
    const normalized = this._knownExclusions(excluded);
    return normalized.size < this._allChapters.length ? normalized : new Set();
  }

  destroy(): void {
    this._video.removeEventListener('timeupdate', this._boundOnUpdate);
    this._controller.destroy();
  }
}
