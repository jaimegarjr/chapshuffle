import type { Chapter } from '../types';
import { parse as parseChapters } from '../parser/ChapterParser';
import { PlaybackController } from '../playback/PlaybackController';
import { getShuffleEnabled } from '../persistence/PersistenceManager';

const CONTROLS_SEL = '.ytp-right-controls';
const VIDEO_SEL = 'video';
const STYLES_ID = 'chapshuffle-styles';
const PANEL_ID = 'chapshuffle-queue';
const BTN_ID = 'chapshuffle-btn';
const ACTIVE_CLASS = 'chapshuffle-active';
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
    font-size: 18px;
    line-height: 1;
    padding: 0 8px;
    opacity: 0.85;
    vertical-align: middle;
  }
  #chapshuffle-btn:hover { opacity: 1; }
  #chapshuffle-btn[aria-expanded="true"] { opacity: 1; color: #f00; }

  #chapshuffle-queue {
    --chapshuffle-header-height: 44px;
    --chapshuffle-row-height: 34px;
    position: fixed;
    top: 96px;
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
  private _observer: MutationObserver | null = null;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly _boundHighlightUpdate: () => void;

  constructor(doc: Document = document) {
    this._doc = doc;
    this._boundHighlightUpdate = this._updateHighlight.bind(this);
  }

  async init(): Promise<void> {
    await getShuffleEnabled(); // warm storage; value reserved for future per-video opt-out
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
      // Guard: stop if already injected (MutationObserver can re-trigger before
      // clearInterval takes effect when our own DOM writes fire it).
      if (this._doc.getElementById(BTN_ID)) {
        if (this._pollTimer !== null) {
          clearInterval(this._pollTimer);
          this._pollTimer = null;
        }
        return;
      }

      const controls = this._doc.querySelector(CONTROLS_SEL);
      if (!controls) return;

      if (this._pollTimer !== null) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }

      const chapters = parseChapters(this._doc);
      if (chapters && chapters.length >= 5) {
        this._inject(chapters, controls);
      }
    }, POLL_INTERVAL_MS);
  }

  private _inject(chapters: Chapter[], controlsBar: Element): void {
    // Double-injection guard — our own DOM writes can re-trigger the observer.
    if (this._doc.getElementById(BTN_ID)) return;

    // Create the controller first so the panel displays the shuffled queue order.
    const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
    if (video) {
      this._controller = new PlaybackController(video, chapters);
      this._video = video;
      this._video.addEventListener('timeupdate', this._boundHighlightUpdate);
    }

    // Build queue panel using the shuffled order from the controller.
    const queueOrder = this._controller ? this._controller.queue : chapters;
    const panel = this._buildQueuePanel(queueOrder);
    panel.style.display = 'none'; // hidden until user clicks ⇄
    this._doc.body.appendChild(panel);

    controlsBar.prepend(this._buildToggleButton());
    this._updateHighlight();
  }

  // ⇄ button: opens/closes the queue panel.
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
    if (opening) this._positionPanelOverVideo(panel);
    panel.style.display = opening ? 'block' : 'none';
    btn?.setAttribute('aria-expanded', String(opening));
    if (btn) btn.title = opening ? 'ChapShuffle: close queue' : 'ChapShuffle: open queue';

    if (opening) this._updateHighlight();
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

    const preferredTop = rect.bottom - PLAYER_CONTROLS_CLEARANCE_PX - maxPanelHeight;
    const minVideoTop = rect.top + PANEL_MARGIN_PX;
    const maxViewportTop = viewportHeight - maxPanelHeight - VIEWPORT_MARGIN_PX;
    const top = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(Math.max(preferredTop, minVideoTop), Math.max(VIEWPORT_MARGIN_PX, maxViewportTop))
    );

    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = 'auto';
    panel.style.top = `${Math.round(top)}px`;
    panel.style.bottom = 'auto';
    panel.style.maxHeight = `${Math.round(maxPanelHeight)}px`;
  }

  private _buildQueuePanel(chapters: Chapter[]): HTMLDivElement {
    const panel = this._doc.createElement('div');
    panel.id = PANEL_ID;

    const header = this._doc.createElement('div');
    header.id = 'chapshuffle-queue-header';

    const title = this._doc.createElement('span');
    title.id = 'chapshuffle-queue-title';
    title.textContent = 'Shuffle Queue';

    const reshuffleBtn = this._doc.createElement('button');
    reshuffleBtn.id = 'chapshuffle-reshuffle';
    reshuffleBtn.textContent = '⇄ Reshuffle';
    reshuffleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onReshuffle();
    });

    header.appendChild(title);
    header.appendChild(reshuffleBtn);
    panel.appendChild(header);

    chapters.forEach((chapter, i) => panel.appendChild(this._buildQueueItem(chapter, i)));
    return panel;
  }

  private _buildQueueItem(chapter: Chapter, i: number): HTMLDivElement {
    const item = this._doc.createElement('div');
    item.dataset['index'] = String(i);
    item.className = 'chapshuffle-item';

    const titleEl = this._doc.createElement('span');
    titleEl.className = 'chapshuffle-title';
    titleEl.textContent = chapter.title;

    const timeEl = this._doc.createElement('span');
    timeEl.className = 'chapshuffle-time';
    timeEl.textContent = secondsToTimestamp(chapter.startSeconds);

    item.appendChild(titleEl);
    item.appendChild(timeEl);
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log(`[ChapShuffle] click queue[${i}] "${chapter.title}" start=${chapter.startSeconds}s`);
      // Index i maps directly into the controller's shuffled queue because
      // the panel was built from controller.queue in the same order.
      this._controller?.seekToChapter(i);
      this._updateHighlight();
    });
    return item;
  }

  // Replaces the chapter rows in the panel with the controller's current queue.
  private _rebuildQueueItems(): void {
    const panel = this._doc.getElementById(PANEL_ID);
    if (!panel || !this._controller) return;
    panel.querySelectorAll('.chapshuffle-item').forEach((el) => el.remove());
    this._controller.queue.forEach((chapter, i) =>
      panel.appendChild(this._buildQueueItem(chapter, i))
    );
  }

  private _updateHighlight(): void {
    if (!this._controller) return;
    const panel = this._doc.getElementById(PANEL_ID);
    if (!panel) return;
    panel.querySelectorAll('.chapshuffle-item').forEach((item, i) => {
      item.classList.toggle(ACTIVE_CLASS, i === this._controller!.currentIndex);
    });
  }

  private _onReshuffle(): void {
    if (!this._controller) {
      const chapters = parseChapters(this._doc);
      const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
      if (chapters && video) this._controller = new PlaybackController(video, chapters);
    } else {
      this._controller.reshuffle();
    }
    // Rebuild panel rows to reflect the new shuffle order, then re-highlight.
    this._rebuildQueueItems();
    this._updateHighlight();
  }

  private _cleanup(): void {
    this._controller?.destroy();
    this._controller = null;
    this._video?.removeEventListener('timeupdate', this._boundHighlightUpdate);
    this._video = null;

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
