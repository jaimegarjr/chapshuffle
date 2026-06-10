export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface SessionResult {
  sessionId: string;
  isNew: boolean;
}

export class AnalyticsSessionManager {
  private _sessionId: string | null = null;
  private _lastActivity: number | null = null;
  private readonly _timeoutMs: number;

  constructor(timeoutMs = SESSION_TIMEOUT_MS) {
    this._timeoutMs = timeoutMs;
  }

  getOrCreate(now = Date.now()): SessionResult {
    const isExpired = this._lastActivity !== null && now - this._lastActivity > this._timeoutMs;

    if (this._sessionId === null || isExpired) {
      this._sessionId = crypto.randomUUID();
      this._lastActivity = now;
      return { sessionId: this._sessionId, isNew: true };
    }

    this._lastActivity = now;
    return { sessionId: this._sessionId, isNew: false };
  }

  touch(now = Date.now()): void {
    if (this._sessionId === null || this._lastActivity === null) return;
    // An expired session must not be revived by late activity ticks;
    // only getOrCreate() may rotate it into a fresh session.
    if (now - this._lastActivity > this._timeoutMs) return;
    this._lastActivity = now;
  }

  reset(): void {
    this._sessionId = null;
    this._lastActivity = null;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get lastActivity(): number | null {
    return this._lastActivity;
  }
}
