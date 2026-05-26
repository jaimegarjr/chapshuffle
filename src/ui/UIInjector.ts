import type { Chapter } from '../types';
import { parse as parseChapters } from '../parser/ChapterParser';
import { PlaybackController } from '../playback/PlaybackController';
import { getShuffleEnabled } from '../persistence/PersistenceManager';

const CONTROLS_SEL = '.ytp-right-controls';
const VIDEO_SEL = 'video';
const STYLES_ID = 'chapshuffule-styles';
const PANEL_ID = 'chapshuffule-queue';
const BTN_ID = 'chapshuffule-btn';
const ACTIVE_CLASS = 'chapshuffule-active';
const POLL_INTERVAL_MS = 500;

const CSS = `
  #chapshuffule-btn {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 8px;
    opacity: 0.85;
    vertical-align: middle;
  }
  #chapshuffule-btn:hover { opacity: 1; }
  #chapshuffule-btn[aria-expanded="true"] { opacity: 1; color: #f00; }

  #chapshuffule-queue {
    position: fixed;
    top: 50%;
    right: 24px;
    transform: translateY(-50%);
    width: 300px;
    max-height: 60vh;
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

  #chapshuffule-queue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    gap: 8px;
  }
  #chapshuffule-queue-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.55;
    flex: 1;
  }
  #chapshuffule-reshuffle {
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
  #chapshuffule-reshuffle:hover { background: rgba(255,255,255,0.16); }

  .chapshuffule-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    cursor: pointer;
    gap: 10px;
    border-left: 3px solid transparent;
    transition: background 0.1s;
  }
  .chapshuffule-item:hover { background: rgba(255,255,255,0.08); }
  .chapshuffule-item.chapshuffule-active {
    border-left-color: #f00;
    background: rgba(255, 0, 0, 0.12);
    font-weight: 600;
  }
  .chapshuffule-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chapshuffule-time {
    opacity: 0.5;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }
`;

export class UIInjector {
  private readonly _doc: Document;
  private _controller: PlaybackController | null = null;
  private _observer: MutationObserver | null = null;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _shuffleEnabled = false;

  constructor(doc: Document = document) {
    this._doc = doc;
  }

  async init(): Promise<void> {
    this._shuffleEnabled = await getShuffleEnabled();
    this._injectStyles();
    this._startObserver();
    this._startPoll();
  }

  private _injectStyles(): void {
    if (this._doc.getElementById(STYLES_ID)) return;
    const style = this._doc.createElement('style');
    style.id = STYLES_ID;
    style.textContent = CSS;
    (this._doc.head ?? this._doc.documentElement).appendChild(style);
  }

  // Watches document.body for URL changes (YouTube SPA navigation) and
  // re-initialises for the new video.
  private _startObserver(): void {
    if (!this._doc.body) return;
    let lastUrl = this._doc.location?.href ?? '';
    this._observer = new MutationObserver(() => {
      const current = this._doc.location?.href ?? '';
      if (current !== lastUrl) {
        lastUrl = current;
        this._cleanup();
        this._startPoll();
      }
    });
    this._observer.observe(this._doc.body, { childList: true, subtree: true });
  }

  private _startPoll(): void {
    this._pollTimer = setInterval(() => {
      const controls = this._doc.querySelector(CONTROLS_SEL);
      if (!controls) return;

      clearInterval(this._pollTimer!);
      this._pollTimer = null;

      const chapters = parseChapters(this._doc);
      if (chapters && chapters.length >= 5) {
        this._inject(chapters, controls);
      }
    }, POLL_INTERVAL_MS);
  }

  private _inject(chapters: Chapter[], controlsBar: Element): void {
    // Panel is hidden until the user clicks ⇄.
    const panel = this._buildQueuePanel(chapters);
    panel.style.display = 'none';
    this._doc.body.appendChild(panel);

    controlsBar.prepend(this._buildToggleButton());

    if (this._shuffleEnabled) {
      const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
      if (video) {
        this._controller = new PlaybackController(video, chapters);
        this._updateHighlight();
      }
    }
  }

  // ⇄ button: toggles the queue panel open/closed.
  private _buildToggleButton(): HTMLButtonElement {
    const btn = this._doc.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = '⇄';
    btn.title = 'ChapShuffle: open queue';
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
    panel.style.display = opening ? 'block' : 'none';
    btn?.setAttribute('aria-expanded', String(opening));
    btn!.title = opening ? 'ChapShuffle: close queue' : 'ChapShuffle: open queue';

    // Lazily activate the controller on first open if not already running.
    if (opening && !this._controller) {
      const chapters = parseChapters(this._doc);
      const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
      if (chapters && video) {
        this._controller = new PlaybackController(video, chapters);
        this._updateHighlight();
      }
    }
  }

  private _buildQueuePanel(chapters: Chapter[]): HTMLDivElement {
    const panel = this._doc.createElement('div');
    panel.id = PANEL_ID;

    // Header row: label + Reshuffle button.
    const header = this._doc.createElement('div');
    header.id = 'chapshuffule-queue-header';

    const title = this._doc.createElement('span');
    title.id = 'chapshuffule-queue-title';
    title.textContent = 'Shuffle Queue';

    const reshuffleBtn = this._doc.createElement('button');
    reshuffleBtn.id = 'chapshuffule-reshuffle';
    reshuffleBtn.textContent = '⇄ Reshuffle';
    reshuffleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onReshuffle();
    });

    header.appendChild(title);
    header.appendChild(reshuffleBtn);
    panel.appendChild(header);

    chapters.forEach((chapter, i) => {
      const item = this._doc.createElement('div');
      item.dataset['index'] = String(i);
      item.className = 'chapshuffule-item';

      const titleEl = this._doc.createElement('span');
      titleEl.className = 'chapshuffule-title';
      titleEl.textContent = chapter.title;

      const timeEl = this._doc.createElement('span');
      timeEl.className = 'chapshuffule-time';
      timeEl.textContent = secondsToTimestamp(chapter.startSeconds);

      item.appendChild(titleEl);
      item.appendChild(timeEl);
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this._controller?.seekToChapter(i);
        this._updateHighlight();
      });
      panel.appendChild(item);
    });

    return panel;
  }

  private _updateHighlight(): void {
    if (!this._controller) return;
    const panel = this._doc.getElementById(PANEL_ID);
    if (!panel) return;
    panel.querySelectorAll('.chapshuffule-item').forEach((item, i) => {
      item.classList.toggle(ACTIVE_CLASS, i === this._controller!.currentIndex);
    });
  }

  private _onReshuffle(): void {
    if (this._controller) {
      this._controller.reshuffle();
    } else {
      const chapters = parseChapters(this._doc);
      const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
      if (chapters && video) {
        this._controller = new PlaybackController(video, chapters);
      }
    }
    this._updateHighlight();
  }

  private _cleanup(): void {
    this._controller?.destroy();
    this._controller = null;

    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    for (const id of [BTN_ID, PANEL_ID]) {
      this._doc.getElementById(id)?.remove();
    }
  }

  destroy(): void {
    this._observer?.disconnect();
    this._observer = null;
    this._cleanup();
  }
}

function secondsToTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
