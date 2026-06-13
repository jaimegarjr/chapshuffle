import type { Chapter } from '../types';
import { createDebugLogger } from '../debug/DebugLogger';

const debug = createDebugLogger('youtube-nav');

const CONTROLS_SEL = '.ytp-right-controls';
const VIDEO_SEL = 'video';
const POLL_INTERVAL_MS = 500;
// Chapter data can lag a navigation while the page world is queried, so keep
// polling until it arrives rather than giving up on the first empty ticks. At
// 500ms this is ~15s, long enough for slow loads while still stopping on
// videos that genuinely have no chapters.
const MAX_EMPTY_POLLS = 30;

interface YouTubeChapterWatcherOptions {
  minChapters: number;
  isInjected: () => boolean;
  onNavigate: () => void;
  onChaptersReady: (chapters: Chapter[], controlsBar: Element) => void;
  onLivestream: () => void;
  readChapters: () => Chapter[] | null;
  requestRefresh?: () => void;
}

export class YouTubeChapterWatcher {
  private readonly _doc: Document;
  private _minChapters: number;
  private readonly _isInjected: () => boolean;
  private readonly _onNavigate: () => void;
  private readonly _onChaptersReady: (chapters: Chapter[], controlsBar: Element) => void;
  private readonly _onLivestream: () => void;
  private readonly _readChapters: () => Chapter[] | null;
  private readonly _requestRefresh?: () => void;
  private readonly _boundNavigateFinish: () => void;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _started = false;

  constructor(doc: Document, options: YouTubeChapterWatcherOptions) {
    this._doc = doc;
    this._minChapters = options.minChapters;
    this._isInjected = options.isInjected;
    this._onNavigate = options.onNavigate;
    this._onChaptersReady = options.onChaptersReady;
    this._onLivestream = options.onLivestream;
    this._readChapters = options.readChapters;
    this._requestRefresh = options.requestRefresh;
    this._boundNavigateFinish = this._handleNavigate.bind(this);
  }

  start(): void {
    if (this._started) return;
    this._started = true;
    this._doc.addEventListener('yt-navigate-finish', this._boundNavigateFinish);
    this._startPoll();
  }

  set minChapters(value: number) {
    if (value === this._minChapters) return;
    this._minChapters = value;
    if (this._started) this._startPoll();
  }

  destroy(): void {
    this._started = false;
    this._doc.removeEventListener('yt-navigate-finish', this._boundNavigateFinish);
    this._stopPoll();
  }

  private _handleNavigate(): void {
    debug.log('yt-navigate-finish fired - url=' + (this._doc.location?.href ?? '?'));
    this._onNavigate();
    this._startPoll();
  }

  private _startPoll(): void {
    this._stopPoll();
    let lastSig = '';
    let emptyPolls = 0;
    debug.log('startPoll - waiting for stable chapter fingerprint');
    this._pollTimer = setInterval(() => {
      if (this._isInjected()) {
        debug.log('poll: already injected, stopping');
        this._stopPoll();
        return;
      }

      const controls = this._doc.querySelector(CONTROLS_SEL);
      if (!controls) {
        lastSig = '';
        return;
      }

      if (this._isLivestream()) {
        this._stopPoll();
        this._onLivestream();
        return;
      }

      this._requestRefresh?.();
      const chapters = this._readChapters();

      if (chapters === null || chapters.length === 0) {
        // Chapter data can lag; keep waiting rather than concluding there are
        // none on the first empty ticks.
        lastSig = '';
        emptyPolls += 1;
        if (emptyPolls >= MAX_EMPTY_POLLS) {
          this._stopPoll();
          debug.log(`poll: no chapters after ${emptyPolls} polls - stopping`);
        }
        return;
      }

      emptyPolls = 0;
      const sig = chapters.map((c) => `${c.startSeconds}:${c.title}`).join('|');

      if (sig !== lastSig) {
        debug.log(`poll: chapters=${chapters.length} (changed), waiting for stable state`);
        lastSig = sig;
        return;
      }

      this._stopPoll();
      debug.log(`poll: stable - ${chapters.length} chapters confirmed across two ticks`);
      if (chapters.length >= this._minChapters) {
        this._onChaptersReady(chapters, controls);
      }
    }, POLL_INTERVAL_MS);
  }

  private _stopPoll(): void {
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  private _isLivestream(): boolean {
    const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
    return (
      (video !== null && video.duration === Infinity) ||
      this._doc.querySelector('.ytp-live') !== null
    );
  }
}
