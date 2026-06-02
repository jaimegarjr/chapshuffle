import type { Chapter } from '../types';
import { parse as parseChapters } from '../parser/ChapterParser';
import { PlaybackController } from '../playback/PlaybackController';
import {
  DEFAULT_SETTINGS,
  getSettings,
  getTutorialComplete,
  setTutorialComplete,
  settingsChangeFromChrome,
  type QueueEndBehavior,
} from '../persistence/PersistenceManager';
import {
  getExclusions,
  setExclusions,
  clearExclusions,
} from '../exclusion/ExclusionManager';
import { InjectedQueueShell } from './InjectedQueueShell';
import { TutorialManager } from './Tutorial';
import { YouTubeChapterWatcher } from '../youtube/YouTubeChapterWatcher';

const VIDEO_SEL = 'video';

export class UIInjector {
  private readonly _doc: Document;
  private readonly _shell: InjectedQueueShell;
  private _watcher: YouTubeChapterWatcher | null = null;
  private _controller: PlaybackController | null = null;
  private _video: HTMLVideoElement | null = null;
  private _autoAdvance = DEFAULT_SETTINGS.shuffleEnabled;
  private _minChapters = DEFAULT_SETTINGS.minChapters;
  private _queueEndBehavior: QueueEndBehavior = DEFAULT_SETTINGS.queueEndBehavior;
  private _loopMode = false;
  private _tutorial: TutorialManager | null = null;
  private _videoId: string | null = null;
  private _excluded: Set<number> = new Set();
  private _allChapters: Chapter[] = [];
  private readonly _boundHighlightUpdate: () => void;
  private readonly _boundStorageChange: (changes: {
    [key: string]: chrome.storage.StorageChange;
  }) => void;

  constructor(doc: Document = document) {
    this._doc = doc;
    this._shell = new InjectedQueueShell(doc, () => this._renderPanel());
    this._boundHighlightUpdate = this._renderPanel.bind(this);
    this._boundStorageChange = this._onStorageChange.bind(this);
  }

  async init(): Promise<void> {
    const settings = await getSettings();
    this._autoAdvance = settings.shuffleEnabled;
    this._minChapters = settings.minChapters;
    this._queueEndBehavior = settings.queueEndBehavior;
    chrome.storage.onChanged.addListener(this._boundStorageChange);
    this._shell.injectStyles();
    this._watcher = new YouTubeChapterWatcher(this._doc, {
      minChapters: this._minChapters,
      isInjected: () => this._shell.isMounted,
      onNavigate: () => this._resetInjectedState(),
      onChaptersReady: (chapters, controlsBar) => this._inject(chapters, controlsBar),
      onLivestream: () => chrome.runtime.sendMessage({ type: 'livestream-detected' }),
    });
    this._watcher.start();
  }

  private _onStorageChange(changes: { [key: string]: chrome.storage.StorageChange }): void {
    const settingsChange = settingsChangeFromChrome(changes);
    const shuffleEnabled = settingsChange.shuffleEnabled;
    const queueEndBehavior = settingsChange.queueEndBehavior;
    const minChapters = settingsChange.minChapters;

    if (shuffleEnabled !== undefined) {
      this._autoAdvance = shuffleEnabled;
      if (this._controller) this._controller.autoAdvance = this._autoAdvance;
      this._shell.updateShuffleState(this._autoAdvance);
    }
    if (queueEndBehavior !== undefined) {
      this._queueEndBehavior = queueEndBehavior;
      if (this._controller) this._controller.queueEndBehavior = this._queueEndBehavior;
    }
    if (minChapters !== undefined) {
      this._minChapters = minChapters;
      if (this._watcher) this._watcher.minChapters = this._minChapters;
    }
  }

  private _inject(chapters: Chapter[], controlsBar: Element): void {
    if (this._shell.isMounted) return;

    this._allChapters = chapters;
    this._videoId =
      new URLSearchParams(this._doc.defaultView?.location.search ?? '').get('v') ?? null;

    const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
    if (video) {
      this._controller = new PlaybackController(
        video,
        chapters,
        undefined,
        this._autoAdvance,
        this._queueEndBehavior
      );
      this._video = video;
      this._video.addEventListener('timeupdate', this._boundHighlightUpdate);
    }

    this._shell.mount(controlsBar);
    this._shell.updateShuffleState(this._autoAdvance);
    this._renderPanel();
    this._initTutorialIfNeeded();

    if (this._videoId) {
      const videoId = this._videoId;
      getExclusions(videoId)
        .then((exclusions) => {
          if (this._videoId !== videoId) return;
          this._excluded = new Set(exclusions);
          this._controller?.setExcluded(this._excluded);
          this._renderPanel();
        })
        .catch(() => {});
    }
  }

  private _initTutorialIfNeeded(): void {
    getTutorialComplete()
      .then((complete) => {
        if (!complete && this._shell.isMounted) {
          this._tutorial = new TutorialManager(
            this._doc,
            () => {
              setTutorialComplete(true);
            },
            () => {
              this._shell.openPanel();
            }
          );
          this._tutorial.start();
        }
      })
      .catch(() => {});
  }

  private _displayChapters(): Chapter[] {
    const queue = this._controller ? this._controller.queue : [];
    const excluded = this._allChapters.filter((c) => this._excluded.has(c.startSeconds));
    return [...queue, ...excluded];
  }

  private _renderPanel(): void {
    if (!this._controller) return;
    const controller = this._controller;
    const displayChapters = this._displayChapters();
    const queueLength = controller.queue.length;
    this._shell.render({
      chapters: displayChapters,
      currentIndex: controller.currentIndex,
      activeCount: queueLength,
      progress: controller.chapterProgress,
      loopMode: this._loopMode,
      excludedSeconds: this._excluded,
      onSeek: (i: number) => {
        if (i >= queueLength) return;
        controller.seekToChapter(i);
        this._renderPanel();
      },
      onPrev: () => {
        controller.seekToChapter(controller.currentIndex - 1);
        this._renderPanel();
      },
      onNext: () => {
        controller.seekToChapter(controller.currentIndex + 1);
        this._renderPanel();
      },
      onReshuffle: () => this._onReshuffle(),
      onLoopToggle: () => {
        this._loopMode = !this._loopMode;
        controller.loopMode = this._loopMode;
        this._renderPanel();
      },
      onReorder: (fromIndex: number, toIndex: number) => {
        if (fromIndex >= queueLength || toIndex >= queueLength) return;
        controller.reorderQueue(fromIndex, toIndex);
        this._renderPanel();
      },
      onToggleExclusion: (startSeconds: number) => {
        this._onToggleExclusion(startSeconds);
      },
      onClearExclusions: () => {
        this._onClearExclusions();
      },
    });
  }

  private _onToggleExclusion(startSeconds: number): void {
    if (!this._videoId) return;
    if (this._excluded.has(startSeconds)) {
      this._excluded.delete(startSeconds);
      this._controller?.setExcluded(new Set(this._excluded));
      const chapter = this._allChapters.find((c) => c.startSeconds === startSeconds);
      if (chapter) this._controller?.appendToQueue([chapter]);
    } else {
      this._excluded.add(startSeconds);
      this._controller?.setExcluded(new Set(this._excluded));
    }
    setExclusions(this._videoId, Array.from(this._excluded)).catch(() => {});
    this._renderPanel();
  }

  private _onClearExclusions(): void {
    if (!this._videoId) return;
    const toRestore = this._allChapters.filter((c) => this._excluded.has(c.startSeconds));
    this._excluded = new Set();
    this._controller?.setExcluded(this._excluded);
    if (toRestore.length > 0) this._controller?.appendToQueue(toRestore);
    clearExclusions(this._videoId).catch(() => {});
    this._renderPanel();
  }

  private _onReshuffle(): void {
    if (!this._controller) {
      const chapters = parseChapters(this._doc);
      const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
      if (chapters && video)
        this._controller = new PlaybackController(
          video,
          chapters,
          undefined,
          this._autoAdvance,
          this._queueEndBehavior
        );
    } else {
      this._controller.reshuffle();
    }
    this._renderPanel();
  }

  private _resetInjectedState(): void {
    try {
      chrome.runtime.sendMessage({ type: 'livestream-left' });
    } catch {}
    this._tutorial?.destroy();
    this._tutorial = null;
    this._controller?.destroy();
    this._controller = null;
    this._video?.removeEventListener('timeupdate', this._boundHighlightUpdate);
    this._video = null;
    this._loopMode = false;
    this._videoId = null;
    this._excluded = new Set();
    this._allChapters = [];

    this._shell.unmount();
  }

  destroy(): void {
    this._watcher?.destroy();
    this._watcher = null;
    chrome.storage.onChanged.removeListener(this._boundStorageChange);
    this._tutorial?.destroy();
    this._tutorial = null;
    this._resetInjectedState();
  }
}
