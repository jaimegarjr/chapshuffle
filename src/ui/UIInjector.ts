import type { Chapter } from '../types';
import { parse as parseChapters } from '../parser/ChapterParser';
import { PlaybackController } from '../playback/PlaybackController';
import { getShuffleEnabled, setShuffleEnabled } from '../persistence/PersistenceManager';

const CONTROLS_SEL = '.ytp-right-controls';
const VIDEO_SEL = 'video';
const PANEL_ID = 'chapshuffule-queue';
const BTN_ID = 'chapshuffule-btn';
const TOGGLE_ID = 'chapshuffule-toggle';
const ACTIVE_CLASS = 'chapshuffule-active';
const POLL_INTERVAL_MS = 500;

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
    this._startObserver();
    this._startPoll();
  }

  // Watches document.body for child mutations; on a URL change (YouTube SPA
  // navigation), tears down the current session and starts fresh for the new video.
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

  // Polls every 500 ms until the YouTube player controls are present, then
  // checks for chapters and injects the UI if ≥ 5 chapters are found.
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
      // Fewer than 5 chapters → button stays hidden; nothing to inject.
    }, POLL_INTERVAL_MS);
  }

  private _inject(chapters: Chapter[], controlsBar: Element): void {
    controlsBar.prepend(this._buildShuffleButton());
    this._doc.body.appendChild(this._buildQueuePanel(chapters));
    this._doc.body.appendChild(this._buildGlobalToggle());

    if (!this._shuffleEnabled) return;

    const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
    if (!video) return;

    this._controller = new PlaybackController(video, chapters);
    this._updateHighlight();
  }

  private _buildShuffleButton(): HTMLButtonElement {
    const btn = this._doc.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = '⇄';
    btn.title = 'ChapShuffle: reshuffle chapters';
    btn.addEventListener('click', () => this._onReshuffle());
    return btn;
  }

  private _buildQueuePanel(chapters: Chapter[]): HTMLDivElement {
    const panel = this._doc.createElement('div');
    panel.id = PANEL_ID;

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
      item.addEventListener('click', () => {
        this._controller?.seekToChapter(i);
        this._updateHighlight();
      });
      panel.appendChild(item);
    });

    return panel;
  }

  private _buildGlobalToggle(): HTMLLabelElement {
    const label = this._doc.createElement('label');
    label.id = TOGGLE_ID;

    const cb = this._doc.createElement('input');
    cb.type = 'checkbox';
    cb.checked = this._shuffleEnabled;
    cb.addEventListener('change', async () => {
      this._shuffleEnabled = cb.checked;
      await setShuffleEnabled(this._shuffleEnabled);
    });

    label.appendChild(cb);
    label.appendChild(this._doc.createTextNode(' ChapShuffle'));
    return label;
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
    this._controller?.reshuffle();
    this._updateHighlight();
  }

  private _cleanup(): void {
    this._controller?.destroy();
    this._controller = null;

    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    for (const id of [BTN_ID, PANEL_ID, TOGGLE_ID]) {
      this._doc.getElementById(id)?.remove();
    }
  }

  /** Disconnects the MutationObserver and removes all injected elements. */
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
