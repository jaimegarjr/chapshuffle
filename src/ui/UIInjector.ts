import type { Chapter } from '../types';
import { parse as parseChapters } from '../parser/ChapterParser';
import { PlaybackController } from '../playback/PlaybackController';
import {
  DEFAULT_SETTINGS,
  getSettings,
  settingsChangeFromChrome,
  type QueueEndBehavior,
} from '../persistence/PersistenceManager';
import { InjectedQueueShell } from './InjectedQueueShell';
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
    this._renderPanel();
  }

  private _renderPanel(): void {
    if (!this._controller) return;
    const controller = this._controller;
    this._shell.render({
      chapters: controller.queue,
      currentIndex: controller.currentIndex,
      progress: controller.chapterProgress,
      onSeek: (i: number) => {
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
    });
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
    this._controller?.destroy();
    this._controller = null;
    this._video?.removeEventListener('timeupdate', this._boundHighlightUpdate);
    this._video = null;

    this._shell.unmount();
  }

  destroy(): void {
    this._watcher?.destroy();
    this._watcher = null;
    chrome.storage.onChanged.removeListener(this._boundStorageChange);
    this._resetInjectedState();
  }
}
