import type { Chapter } from '../types';
import { createDebugLogger } from '../debug/DebugLogger';

const debug = createDebugLogger('chapter-bridge');
const SOURCE = 'chapshuffle';

interface ChaptersMessage {
  source: typeof SOURCE;
  type: 'chapters';
  chapters: Chapter[] | null;
}

/**
 * Isolated-world counterpart to the MAIN-world `pageChapters` script. It relays
 * chapter requests to the page world and caches whatever chapters come back, so
 * the watcher can read the latest set synchronously while polling.
 */
export class ChapterBridge {
  private readonly _window: Window;
  private _latest: Chapter[] | null = null;
  private readonly _onMessage: (event: MessageEvent) => void;
  private _started = false;

  constructor(win: Window = window) {
    this._window = win;
    this._onMessage = (event) => this._handleMessage(event);
  }

  start(): void {
    if (this._started) return;
    this._started = true;
    this._window.addEventListener('message', this._onMessage);
    this.request();
  }

  stop(): void {
    if (!this._started) return;
    this._started = false;
    this._window.removeEventListener('message', this._onMessage);
    this._latest = null;
  }

  current(): Chapter[] | null {
    return this._latest;
  }

  request(): void {
    this._window.postMessage({ source: SOURCE, type: 'request' }, this._window.location.origin);
  }

  private _handleMessage(event: MessageEvent): void {
    if (event.source !== this._window) return;
    if (event.origin !== this._window.location.origin) return;
    const data = event.data as Partial<ChaptersMessage> | null;
    if (!data || data.source !== SOURCE || data.type !== 'chapters') return;
    this._latest = Array.isArray(data.chapters) && data.chapters.length > 0 ? data.chapters : null;
    debug.log(`received ${this._latest?.length ?? 'null'} chapters from page world`);
  }
}
