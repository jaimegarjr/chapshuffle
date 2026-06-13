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
import { ChapterBridge } from '../youtube/ChapterBridge';
import { analyticsReporter } from '../analytics/AnalyticsReporter';
import { PlaybackActivityMonitor } from '../analytics/PlaybackActivityMonitor';

const VIDEO_SEL = 'video';

export class UIInjector {
  private readonly _doc: Document;
  private readonly _shell: InjectedQueueShell;
  private _watcher: YouTubeChapterWatcher | null = null;
  private _chapterBridge: ChapterBridge | null = null;
  private _session: SessionController | null = null;
  private _autoAdvance = DEFAULT_SETTINGS.shuffleEnabled;
  private _minChapters = DEFAULT_SETTINGS.minChapters;
  private _queueEndBehavior: QueueEndBehavior = DEFAULT_SETTINGS.queueEndBehavior;
  private _tutorial: TutorialManager | null = null;
  private _sessionGeneration = 0;
  private _unsubscribeSettings: (() => void) | null = null;
  private _video: HTMLVideoElement | null = null;
  private _playingHandler: (() => void) | null = null;
  private _activityMonitor: PlaybackActivityMonitor | null = null;
  private _analyticsVideoSessionId: string | null = null;
  private _analyticsQueue: Promise<void> = Promise.resolve();

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
    this._chapterBridge = new ChapterBridge(this._doc.defaultView ?? window);
    this._chapterBridge.start();
    this._watcher = new YouTubeChapterWatcher(this._doc, {
      minChapters: this._minChapters,
      isInjected: () => this._shell.isMounted,
      onNavigate: () => this._resetInjectedState(),
      onChaptersReady: (chapters, controlsBar) => this._inject(chapters, controlsBar),
      onLivestream: () => chrome.runtime.sendMessage({ type: 'livestream-detected' }),
      readChapters: () => this._chapterBridge?.current() ?? null,
      requestRefresh: () => this._chapterBridge?.request(),
    });
    this._watcher.start();
  }

  private _onSettingsChange(changes: Partial<Settings>): void {
    const { shuffleEnabled, queueEndBehavior, minChapters } = changes;

    if (shuffleEnabled !== undefined) {
      this._autoAdvance = shuffleEnabled;
      if (this._session) this._session.autoAdvance = this._autoAdvance;
      this._shell.updateShuffleState(this._autoAdvance);
      if (this._autoAdvance && this._video) {
        this._setupPlaybackTelemetry(this._video);
      } else if (!this._autoAdvance) {
        this._teardownPlaybackTelemetry();
      }
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
      onAnalyticsEvent: ({ name, params }) =>
        this._queueAnalytics(video, (sessionId) =>
          analyticsReporter.notifyProductEvent(name, params, sessionId)
        ),
    }).then((session) => {
      if (generation !== this._sessionGeneration) {
        session.destroy();
        return;
      }

      this._session = session;
      this._video = video;
      session.autoAdvance = this._autoAdvance;
      session.queueEndBehavior = this._queueEndBehavior;
      this._shell.mount(controlsBar);
      this._shell.updateShuffleState(this._autoAdvance);
      this._renderPanel();
      this._initTutorialIfNeeded();
      if (this._autoAdvance) {
        this._setupPlaybackTelemetry(video);
      }
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
    const session = this._session;
    this._shell.render({
      session: session.snapshot,
      onAction: (action) => {
        if (this._session !== session) return;
        session.perform(action);
        this._renderPanel();
      },
    });
  }

  private _setupPlaybackTelemetry(video: HTMLVideoElement): void {
    // Remove any existing listener before attaching a new one.
    this._teardownPlaybackTelemetry();

    this._activityMonitor = new PlaybackActivityMonitor(
      video,
      () => analyticsReporter.touchSession(),
      undefined,
      (activePlaybackMs) =>
        this._queueAnalytics(video, (sessionId) =>
          analyticsReporter.notifyActivePlayback(activePlaybackMs, sessionId)
        )
    );
    this._activityMonitor.start();

    this._playingHandler = (): void => {
      this._queueAnalytics(video, (sessionId) =>
        analyticsReporter.notifyEligiblePlayback(sessionId)
      );
    };
    video.addEventListener('playing', this._playingHandler);

    if (!video.paused && !video.ended) {
      // Video is already playing — notify immediately.
      this._playingHandler();
    }
  }

  private _queueAnalytics(
    video: HTMLVideoElement,
    report: (sessionId: string | null) => Promise<string | null>
  ): void {
    this._analyticsQueue = this._analyticsQueue
      .then(async () => {
        const sessionId = await report(this._analyticsVideoSessionId);
        if (sessionId && this._video === video) {
          this._analyticsVideoSessionId = sessionId;
        }
      })
      .catch(() => {});
  }

  private _teardownPlaybackTelemetry(): void {
    this._activityMonitor?.stop();
    this._activityMonitor = null;
    if (this._playingHandler && this._video) {
      this._video.removeEventListener('playing', this._playingHandler);
    }
    this._playingHandler = null;
  }

  private _resetInjectedState(reason: 'navigation_away' | 'tab_closed' = 'navigation_away'): void {
    this._sessionGeneration++;
    this._teardownPlaybackTelemetry();
    if (reason === 'tab_closed') {
      analyticsReporter.markSessionInactive(reason).catch(() => {});
    } else {
      this._analyticsQueue = this._analyticsQueue
        .then(() => analyticsReporter.markSessionInactive(reason))
        .catch(() => {});
    }
    this._video = null;
    this._analyticsVideoSessionId = null;
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
    this._chapterBridge?.stop();
    this._chapterBridge = null;
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = null;
    this._tutorial?.destroy();
    this._tutorial = null;
    this._resetInjectedState('tab_closed');
  }
}
