export const ACTIVITY_REFRESH_INTERVAL_MS = 60 * 1000;

interface PlaybackTarget {
  readonly paused: boolean;
  readonly ended: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export class PlaybackActivityMonitor {
  private readonly _video: PlaybackTarget;
  private readonly _onActivity: () => void;
  private readonly _intervalMs: number;
  private _timer: ReturnType<typeof setInterval> | null = null;

  private readonly _handlePlaying = (): void => this._startTicking();
  private readonly _handleStopped = (): void => this._stopTicking();

  constructor(
    video: PlaybackTarget,
    onActivity: () => void,
    intervalMs = ACTIVITY_REFRESH_INTERVAL_MS
  ) {
    this._video = video;
    this._onActivity = onActivity;
    this._intervalMs = intervalMs;
  }

  start(): void {
    this._video.addEventListener('playing', this._handlePlaying);
    this._video.addEventListener('pause', this._handleStopped);
    this._video.addEventListener('ended', this._handleStopped);
    if (!this._video.paused && !this._video.ended) {
      this._startTicking();
    }
  }

  stop(): void {
    this._video.removeEventListener('playing', this._handlePlaying);
    this._video.removeEventListener('pause', this._handleStopped);
    this._video.removeEventListener('ended', this._handleStopped);
    this._stopTicking();
  }

  private _startTicking(): void {
    if (this._timer !== null) return;
    this._timer = setInterval(this._onActivity, this._intervalMs);
  }

  private _stopTicking(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}
