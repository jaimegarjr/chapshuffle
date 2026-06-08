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
}

export interface SessionSnapshot {
  queue: Chapter[];
  allChapters: Chapter[];
  currentIndex: number;
  activeCount: number;
  progress: number;
  loopMode: boolean;
  excludedSeconds: Set<number>;
}

export class SessionController {
  private readonly _controller: PlaybackController;
  private readonly _allChapters: Chapter[];
  private readonly _videoId: string | null;
  private _loopMode = false;
  private _excluded: Set<number> = new Set();
  private readonly _boundOnUpdate: () => void;
  private readonly _video: HTMLVideoElement;

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
      new Set(storedExclusions)
    );
  }

  private constructor(
    video: HTMLVideoElement,
    chapters: Chapter[],
    videoId: string | null,
    autoAdvance: boolean,
    queueEndBehavior: QueueEndBehavior,
    onUpdate: () => void,
    initialExclusions: Set<number> = new Set()
  ) {
    this._video = video;
    this._allChapters = chapters;
    this._videoId = videoId;
    this._controller = new PlaybackController(
      video,
      chapters,
      undefined,
      autoAdvance,
      queueEndBehavior
    );
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
      activeCount: this._controller.queue.length,
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

  toggleLoopMode(): void {
    this._loopMode = !this._loopMode;
    this._controller.loopMode = this._loopMode;
  }

  seekToChapter(index: number): void {
    this._controller.seekToChapter(index);
  }

  reshuffle(): void {
    this._controller.reshuffle();
  }

  reorderQueue(fromIndex: number, toIndex: number): boolean {
    return this._controller.reorderQueue(fromIndex, toIndex);
  }

  applyExclusions(nextExcluded: Set<number>): void {
    const normalized = this._knownExclusions(nextExcluded);
    if (this._allChapters.length > 0 && normalized.size >= this._allChapters.length) return;

    const toRestore = this._allChapters.filter(
      (c) => this._excluded.has(c.startSeconds) && !normalized.has(c.startSeconds)
    );

    this._excluded = normalized;
    this._controller.setExcluded(this._excluded);
    if (toRestore.length > 0) this._controller.appendToQueue(toRestore);

    if (this._videoId) {
      setExclusions(this._videoId, [...this._excluded]).catch(() => {});
    }
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
