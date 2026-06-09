export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;
  const hex = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
      this._sessionId = generateSessionId();
      this._lastActivity = now;
      return { sessionId: this._sessionId, isNew: true };
    }

    this._lastActivity = now;
    return { sessionId: this._sessionId, isNew: false };
  }

  touch(now = Date.now()): void {
    if (this._sessionId !== null) {
      this._lastActivity = now;
    }
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
