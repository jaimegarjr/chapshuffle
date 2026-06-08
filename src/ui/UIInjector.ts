import type { Chapter } from '../types';
import { SessionController } from '../playback/SessionController';
import {
  DEFAULT_SETTINGS,
  getTutorialComplete,
  settings,
  setTutorialComplete,
  type QueueEndBehavior,
  type Settings,
} from '../persistence/PersistenceManager';
import { InjectedQueueShell } from './InjectedQueueShell';
import { TutorialManager } from './Tutorial';
import { YouTubeChapterWatcher } from '../youtube/YouTubeChapterWatcher';

const VIDEO_SEL = 'video';

export class UIInjector {
  private readonly _doc: Document;
  private readonly _shell: InjectedQueueShell;
  private _watcher: YouTubeChapterWatcher | null = null;
  private _session: SessionController | null = null;
  private _autoAdvance = DEFAULT_SETTINGS.shuffleEnabled;
  private _minChapters = DEFAULT_SETTINGS.minChapters;
  private _queueEndBehavior: QueueEndBehavior = DEFAULT_SETTINGS.queueEndBehavior;
  private _tutorial: TutorialManager | null = null;
  private _sessionGeneration = 0;
  private _unsubscribeSettings: (() => void) | null = null;

  constructor(doc: Document = document) {
    this._doc = doc;
    this._shell = new InjectedQueueShell(doc, () => this._renderPanel());
  }

  async init(): Promise<void> {
    const initialSettings = await settings.read();
    this._autoAdvance = initialSettings.shuffleEnabled;
    this._minChapters = initialSettings.minChapters;
    this._queueEndBehavior = initialSettings.queueEndBehavior;
    this._unsubscribeSettings = settings.subscribe((changes) => this._onSettingsChange(changes));
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

  private _onSettingsChange(changes: Partial<Settings>): void {
    const { shuffleEnabled, queueEndBehavior, minChapters } = changes;

    if (shuffleEnabled !== undefined) {
      this._autoAdvance = shuffleEnabled;
      if (this._session) this._session.autoAdvance = this._autoAdvance;
      this._shell.updateShuffleState(this._autoAdvance);
    }
    if (queueEndBehavior !== undefined) {
      this._queueEndBehavior = queueEndBehavior;
      if (this._session) this._session.queueEndBehavior = this._queueEndBehavior;
    }
    if (minChapters !== undefined) {
      this._minChapters = minChapters;
      if (this._watcher) this._watcher.minChapters = this._minChapters;
    }
  }

  private _inject(chapters: Chapter[], controlsBar: Element): void {
    if (this._shell.isMounted) return;

    const generation = ++this._sessionGeneration;
    const videoId =
      new URLSearchParams(this._doc.defaultView?.location.search ?? '').get('v') ?? null;
    const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
    if (!video) return;

    SessionController.create({
      video,
      chapters,
      videoId,
      autoAdvance: this._autoAdvance,
      queueEndBehavior: this._queueEndBehavior,
      onUpdate: () => this._renderPanel(),
    }).then((session) => {
      if (generation !== this._sessionGeneration) {
        session.destroy();
        return;
      }

      this._session = session;
      session.autoAdvance = this._autoAdvance;
      session.queueEndBehavior = this._queueEndBehavior;
      this._shell.mount(controlsBar);
      this._shell.updateShuffleState(this._autoAdvance);
      this._renderPanel();
      this._initTutorialIfNeeded();
    });
  }

  private _initTutorialIfNeeded(): void {
    getTutorialComplete()
      .then((complete) => {
        if (!complete && this._shell.isMounted) {
          this._tutorial = new TutorialManager(
            this._doc,
            () => setTutorialComplete(true),
            () => this._shell.openPanel()
          );
          this._tutorial.start();
        }
      })
      .catch(() => {});
  }

  private _renderPanel(): void {
    if (!this._session) return;
    const snap = this._session.snapshot;
    const queueLength = snap.activeCount;
    this._shell.render({
      chapters: snap.queue,
      allChapters: snap.allChapters,
      currentIndex: snap.currentIndex,
      activeCount: queueLength,
      progress: snap.progress,
      loopMode: snap.loopMode,
      excludedSeconds: snap.excludedSeconds,
      onSeek: (i: number) => {
        if (i >= queueLength) return;
        this._session?.seekToChapter(i);
        this._renderPanel();
      },
      onPrev: () => {
        this._session?.seekToChapter(snap.currentIndex - 1);
        this._renderPanel();
      },
      onNext: () => {
        this._session?.seekToChapter(snap.currentIndex + 1);
        this._renderPanel();
      },
      onReshuffle: () => this._onReshuffle(),
      onLoopToggle: () => {
        this._session?.toggleLoopMode();
        this._renderPanel();
      },
      onReorder: (fromIndex: number, toIndex: number) => {
        if (fromIndex >= queueLength || toIndex >= queueLength) return;
        this._session?.reorderQueue(fromIndex, toIndex);
        this._renderPanel();
      },
      onApplyExclusions: (excludedSeconds: Set<number>) => {
        this._session?.applyExclusions(excludedSeconds);
        this._renderPanel();
      },
    });
  }

  private _onReshuffle(): void {
    this._session?.reshuffle();
    this._renderPanel();
  }

  private _resetInjectedState(): void {
    this._sessionGeneration++;
    try {
      chrome.runtime.sendMessage({ type: 'livestream-left' });
    } catch {}
    this._tutorial?.destroy();
    this._tutorial = null;
    this._session?.destroy();
    this._session = null;
    this._shell.unmount();
  }

  destroy(): void {
    this._watcher?.destroy();
    this._watcher = null;
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = null;
    this._tutorial?.destroy();
    this._tutorial = null;
    this._resetInjectedState();
  }
}
