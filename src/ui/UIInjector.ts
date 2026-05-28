import type { Chapter } from '../types';
import { parse as parseChapters } from '../parser/ChapterParser';
import { PlaybackController } from '../playback/PlaybackController';
import {
  getShuffleEnabled,
  getMinChapters,
  getQueueEndBehavior,
  type QueueEndBehavior,
} from '../persistence/PersistenceManager';
import { InjectedQueueShell } from './InjectedQueueShell';
import { YouTubeChapterWatcher } from '../youtube/YouTubeChapterWatcher';

const STORAGE_KEY = 'shuffleEnabled';
const QUEUE_END_KEY = 'queueEndBehavior';
const VIDEO_SEL = 'video';

export class UIInjector {
  private readonly _doc: Document;
  private readonly _shell: InjectedQueueShell;
  private _watcher: YouTubeChapterWatcher | null = null;
  private _controller: PlaybackController | null = null;
  private _video: HTMLVideoElement | null = null;
  private _autoAdvance = true;
  private _minChapters = 5;
  private _queueEndBehavior: QueueEndBehavior = 'reshuffle';
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
    [this._autoAdvance, this._minChapters, this._queueEndBehavior] = await Promise.all([
      getShuffleEnabled(),
      getMinChapters(),
      getQueueEndBehavior(),
    ]);
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
    if (STORAGE_KEY in changes) {
      this._autoAdvance = Boolean(changes[STORAGE_KEY].newValue);
      if (this._controller) this._controller.autoAdvance = this._autoAdvance;
    }
    if (QUEUE_END_KEY in changes) {
      const val = changes[QUEUE_END_KEY].newValue;
      this._queueEndBehavior = val === 'end-video' ? 'end-video' : 'reshuffle';
      if (this._controller) this._controller.queueEndBehavior = this._queueEndBehavior;
    }
    if ('minChapters' in changes) {
      const val = changes.minChapters.newValue;
      this._minChapters = typeof val === 'number' && val >= 2 ? val : this._minChapters;
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
