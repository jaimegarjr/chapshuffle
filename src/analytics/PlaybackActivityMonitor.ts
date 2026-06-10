export const ACTIVITY_REFRESH_INTERVAL_MS = 60 * 1000;
export const ACTIVE_PLAYBACK_HEARTBEAT_MS = 5 * 60 * 1000;

interface PlaybackTarget {
  readonly paused: boolean;
  readonly ended: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export class PlaybackActivityMonitor {
  private readonly _video: PlaybackTarget;
  private readonly _onActivity: () => void;
  private readonly _onHeartbeat: (activePlaybackMs: number) => void;
  private readonly _intervalMs: number;
  private readonly _heartbeatMs: number;
  private readonly _now: () => number;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _lastTick: number | null = null;
  private _activeSinceHeartbeat = 0;

  private readonly _handlePlaying = (): void => this._startTicking();
  private readonly _handleStopped = (): void => this._stopTicking();

  constructor(
    video: PlaybackTarget,
    onActivity: () => void,
    intervalMs = ACTIVITY_REFRESH_INTERVAL_MS,
    onHeartbeat: (activePlaybackMs: number) => void = () => {},
    heartbeatMs = ACTIVE_PLAYBACK_HEARTBEAT_MS,
    now: () => number = Date.now
  ) {
    this._video = video;
    this._onActivity = onActivity;
    this._intervalMs = intervalMs;
    this._onHeartbeat = onHeartbeat;
    this._heartbeatMs = heartbeatMs;
    this._now = now;
  }

  start(): void {
    this._video.addEventListener('playing', this._handlePlaying);
    this._video.addEventListener('pause', this._handleStopped);
    this._video.addEventListener('ended', this._handleStopped);
    this._video.addEventListener('waiting', this._handleStopped);
    this._video.addEventListener('stalled', this._handleStopped);
    if (!this._video.paused && !this._video.ended) {
      this._startTicking();
    }
  }

  stop(): void {
    this._video.removeEventListener('playing', this._handlePlaying);
    this._video.removeEventListener('pause', this._handleStopped);
    this._video.removeEventListener('ended', this._handleStopped);
    this._video.removeEventListener('waiting', this._handleStopped);
    this._video.removeEventListener('stalled', this._handleStopped);
    this._stopTicking();
  }

  private _startTicking(): void {
    if (this._timer !== null) return;
    this._lastTick = this._now();
    this._timer = setInterval(() => this._recordActivity(), this._intervalMs);
  }

  private _stopTicking(): void {
    if (this._timer !== null) {
      this._recordActivity();
      clearInterval(this._timer);
      this._timer = null;
    }
    this._lastTick = null;
  }

  private _recordActivity(): void {
    if (this._lastTick === null) return;
    const now = this._now();
    const elapsed = Math.max(0, now - this._lastTick);
    this._lastTick = now;
    if (elapsed === 0) return;

    this._onActivity();
    this._activeSinceHeartbeat += elapsed;
    while (this._activeSinceHeartbeat >= this._heartbeatMs) {
      this._activeSinceHeartbeat -= this._heartbeatMs;
      this._onHeartbeat(this._heartbeatMs);
    }
  }
}
