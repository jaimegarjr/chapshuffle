import type { Chapter } from '../types';
import { parse as parseChapters } from '../parser/ChapterParser';
import { PlaybackController } from '../playback/PlaybackController';
import {
  getShuffleEnabled,
  getMinChapters,
  getQueueEndBehavior,
  type QueueEndBehavior,
} from '../persistence/PersistenceManager';
import { renderQueuePanel, unmountQueuePanel } from './QueuePanel';

declare const __DEV__: boolean;
function dbg(...args: unknown[]): void {
  if (__DEV__) console.debug('[CS-nav]', ...args);
}

const STORAGE_KEY = 'shuffleEnabled';
const QUEUE_END_KEY = 'queueEndBehavior';
const CONTROLS_SEL = '.ytp-right-controls';
const VIDEO_SEL = 'video';
const STYLES_ID = 'chapshuffle-styles';
const PANEL_ID = 'chapshuffle-queue';
const BTN_ID = 'chapshuffle-btn';
const POLL_INTERVAL_MS = 500;
const PANEL_WIDTH_PX = 300;
const PANEL_MARGIN_PX = 24;
const PLAYER_CONTROLS_CLEARANCE_PX = 72;
const VIEWPORT_MARGIN_PX = 16;

const CSS = `
  #chapshuffle-btn {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    padding: 0 8px;
    opacity: 0.85;
    vertical-align: middle;
    display: inline-flex;
    align-items: center;
  }
  #chapshuffle-btn:hover { opacity: 1; }
  #chapshuffle-btn[aria-expanded="true"] { opacity: 1; color: #f00; }

  #chapshuffle-queue {
    --chapshuffle-header-height: 44px;
    --chapshuffle-row-height: 34px;
    position: fixed;
    top: auto;
    right: 24px;
    width: ${PANEL_WIDTH_PX}px;
    max-height: min(
      calc(var(--chapshuffle-header-height) + (var(--chapshuffle-row-height) * 10) + 6px),
      calc(100vh - 160px)
    );
    overflow-y: auto;
    background: rgba(15, 15, 15, 0.93);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 0 0 6px;
    z-index: 2147483647;
    color: #fff;
    font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
    font-size: 13px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.65);
  }
  #chapshuffle-queue,
  #chapshuffle-queue * {
    box-sizing: border-box;
  }

  #chapshuffle-progress {
    height: 3px;
    background: #f00;
    position: sticky;
    top: var(--chapshuffle-header-height);
    z-index: 1;
    transition: width 0.25s linear;
  }

  #chapshuffle-queue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--chapshuffle-header-height);
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    gap: 8px;
    position: sticky;
    top: 0;
    z-index: 1;
    background: #0f0f0f;
    border-radius: 10px 10px 0 0;
    box-shadow: 0 1px 0 rgba(255,255,255,0.1);
  }
  #chapshuffle-queue-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.55;
    flex: 1;
  }
  #chapshuffle-nav {
    display: flex;
    gap: 2px;
  }
  .chapshuffle-nav-btn {
    background: none;
    border: none;
    color: #fff;
    font-size: 14px;
    padding: 2px 6px;
    cursor: pointer;
    opacity: 0.7;
    border-radius: 4px;
    transition: opacity 0.1s, background 0.1s;
  }
  .chapshuffle-nav-btn:hover:not(:disabled) { opacity: 1; background: rgba(255,255,255,0.1); }
  .chapshuffle-nav-btn:disabled { opacity: 0.25; cursor: default; }

  #chapshuffle-reshuffle {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    color: #fff;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 20px;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }
  #chapshuffle-reshuffle:hover { background: rgba(255,255,255,0.16); }

  .chapshuffle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--chapshuffle-row-height);
    padding: 8px 14px;
    cursor: pointer;
    gap: 10px;
    border-left: 3px solid transparent;
    transition: background 0.1s;
  }
  .chapshuffle-item:hover { background: rgba(255,255,255,0.08); }
  .chapshuffle-item.chapshuffle-active {
    border-left-color: #f00;
    background: rgba(255, 0, 0, 0.12);
    font-weight: 600;
  }
  .chapshuffle-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chapshuffle-time {
    opacity: 0.5;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }
`;

export class UIInjector {
  private readonly _doc: Document;
  private _controller: PlaybackController | null = null;
  private _video: HTMLVideoElement | null = null;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _panelMount: HTMLDivElement | null = null;
  private _autoAdvance = true;
  private _minChapters = 5;
  private _queueEndBehavior: QueueEndBehavior = 'reshuffle';
  private readonly _boundHighlightUpdate: () => void;
  private readonly _boundNavigateFinish: () => void;
  private readonly _boundStorageChange: (changes: {
    [key: string]: chrome.storage.StorageChange;
  }) => void;

  constructor(doc: Document = document) {
    this._doc = doc;
    this._boundHighlightUpdate = this._renderPanel.bind(this);
    this._boundNavigateFinish = this._onNavigate.bind(this);
    this._boundStorageChange = this._onStorageChange.bind(this);
  }

  async init(): Promise<void> {
    [this._autoAdvance, this._minChapters, this._queueEndBehavior] = await Promise.all([
      getShuffleEnabled(),
      getMinChapters(),
      getQueueEndBehavior(),
    ]);
    chrome.storage.onChanged.addListener(this._boundStorageChange);
    this._injectStyles();
    this._startObserver();
    this._startPoll();
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
  }

  private _injectStyles(): void {
    if (this._doc.getElementById(STYLES_ID)) return;
    const style = this._doc.createElement('style');
    style.id = STYLES_ID;
    style.textContent = CSS;
    (this._doc.head ?? this._doc.documentElement).appendChild(style);
  }

  private _startObserver(): void {
    this._doc.addEventListener('yt-navigate-finish', this._boundNavigateFinish);
  }

  private _onNavigate(): void {
    dbg('yt-navigate-finish fired — url=' + (this._doc.location?.href ?? '?'));
    if (this._panelMount) {
      dbg('unmounting stale panel mount');
      unmountQueuePanel(this._panelMount);
      this._panelMount.remove();
      this._panelMount = null;
    } else {
      dbg('no panel mount to unmount');
    }
    const hadBtn = !!this._doc.getElementById(BTN_ID);
    this._doc.getElementById(BTN_ID)?.remove();
    dbg(`btn was present=${hadBtn}, controller present=${!!this._controller}`);
    this._cleanup();
    this._startPoll();
  }

  private _startPoll(): void {
    let lastSig = '';
    dbg('startPoll — waiting for stable chapter fingerprint');
    this._pollTimer = setInterval(() => {
      if (this._doc.getElementById(BTN_ID)) {
        dbg('poll: BTN already present, stopping');
        if (this._pollTimer !== null) {
          clearInterval(this._pollTimer);
          this._pollTimer = null;
        }
        return;
      }

      const controls = this._doc.querySelector(CONTROLS_SEL);
      if (!controls) {
        lastSig = '';
        return;
      }

      if (this._isLivestream()) {
        if (this._pollTimer !== null) {
          clearInterval(this._pollTimer);
          this._pollTimer = null;
        }
        chrome.runtime.sendMessage({ type: 'livestream-detected' });
        return;
      }

      const allLists = this._doc.querySelectorAll('ytd-macro-markers-list-renderer');
      const chapterRoot =
        allLists.length > 0 ? (allLists[allLists.length - 1] as Element) : this._doc;
      const chapters = parseChapters(chapterRoot);

      const sig =
        chapters !== null ? chapters.map((c) => `${c.startSeconds}:${c.title}`).join('|') : '\0';

      if (sig !== lastSig) {
        dbg(`poll: chapters=${chapters?.length ?? 'null'} (changed), waiting for stable state`);
        lastSig = sig;
        return;
      }

      if (this._pollTimer !== null) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
      if (chapters === null) {
        dbg('poll: stable null — video has too few or no chapters, stopping');
        return;
      }
      dbg(`poll: stable — ${chapters.length} chapters confirmed across two ticks`);
      if (chapters.length >= this._minChapters) {
        this._inject(chapters, controls);
      }
    }, POLL_INTERVAL_MS);
  }

  private _isLivestream(): boolean {
    const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
    return (
      (video !== null && video.duration === Infinity) ||
      this._doc.querySelector('.ytp-live') !== null
    );
  }

  private _inject(chapters: Chapter[], controlsBar: Element): void {
    if (this._doc.getElementById(BTN_ID)) return;

    const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
    dbg(
      `inject — chapters=[${chapters.map((c) => `"${c.title}"@${c.startSeconds}s`).join(', ')}] ` +
        `video.currentTime=${video?.currentTime ?? 'n/a'} video.duration=${video?.duration ?? 'n/a'}`
    );
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

    this._panelMount = this._doc.createElement('div');
    this._doc.body.appendChild(this._panelMount);
    this._renderPanel();

    const panel = this._doc.getElementById(PANEL_ID);
    if (panel) panel.style.display = 'none';

    controlsBar.prepend(this._buildToggleButton());
  }

  private _renderPanel(): void {
    if (!this._panelMount || !this._controller) return;
    const controller = this._controller;
    renderQueuePanel(this._panelMount, {
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

  private _buildToggleButton(): HTMLButtonElement {
    const btn = this._doc.createElement('button');
    btn.id = BTN_ID;
    btn.innerHTML =
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="m18 14 4 4-4 4"/>` +
      `<path d="m18 2 4 4-4 4"/>` +
      `<path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/>` +
      `<path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/>` +
      `<path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>` +
      `</svg>`;
    btn.title = 'chapshuffle: open queue';
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this._togglePanel();
    });
    return btn;
  }

  private _togglePanel(): void {
    const panel = this._doc.getElementById(PANEL_ID);
    const btn = this._doc.getElementById(BTN_ID);
    if (!panel) return;

    const opening = panel.style.display === 'none';
    if (opening) this._positionPanelOverVideo(panel);
    panel.style.display = opening ? 'block' : 'none';
    btn?.setAttribute('aria-expanded', String(opening));
    if (btn) btn.title = opening ? 'chapshuffle: close queue' : 'chapshuffle: open queue';

    if (opening) this._renderPanel();
  }

  private _positionPanelOverVideo(panel: HTMLElement): void {
    const win = this._doc.defaultView;
    const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
    if (!win || !video) return;

    const rect = video.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const viewportWidth = win.innerWidth || this._doc.documentElement.clientWidth;
    const viewportHeight = win.innerHeight || this._doc.documentElement.clientHeight;
    const maxPanelHeight = Math.min(
      390,
      Math.max(180, rect.height - PANEL_MARGIN_PX * 2),
      Math.max(180, viewportHeight - VIEWPORT_MARGIN_PX * 2)
    );

    const preferredLeft = rect.right - PANEL_WIDTH_PX - PANEL_MARGIN_PX;
    const minVideoLeft = rect.left + PANEL_MARGIN_PX;
    const maxViewportLeft = viewportWidth - PANEL_WIDTH_PX - VIEWPORT_MARGIN_PX;
    const left = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(Math.max(preferredLeft, minVideoLeft), maxViewportLeft)
    );

    const bottomFromViewport = viewportHeight - rect.bottom + PLAYER_CONTROLS_CLEARANCE_PX;

    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = 'auto';
    panel.style.top = 'auto';
    panel.style.bottom = `${Math.round(Math.max(VIEWPORT_MARGIN_PX, bottomFromViewport))}px`;
    panel.style.maxHeight = `${Math.round(maxPanelHeight)}px`;
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

  private _cleanup(): void {
    try {
      chrome.runtime.sendMessage({ type: 'livestream-left' });
    } catch {}
    this._controller?.destroy();
    this._controller = null;
    this._video?.removeEventListener('timeupdate', this._boundHighlightUpdate);
    this._video = null;

    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    if (this._panelMount) {
      unmountQueuePanel(this._panelMount);
      this._panelMount.remove();
      this._panelMount = null;
    }

    this._doc.getElementById(BTN_ID)?.remove();
  }

  destroy(): void {
    this._doc.removeEventListener('yt-navigate-finish', this._boundNavigateFinish);
    chrome.storage.onChanged.removeListener(this._boundStorageChange);
    this._cleanup();
  }
}
