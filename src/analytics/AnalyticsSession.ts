export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface SessionResult {
  sessionId: string;
  isNew: boolean;
  endedSession?: {
    sessionId: string;
    reason: SessionEndReason;
  };
}

export type SessionEndReason = 'navigation_away' | 'tab_closed' | 'expiry';

export interface AnalyticsSession {
  getOrCreate(): Promise<SessionResult>;
  touch(): Promise<void>;
  markInactive(reason: SessionEndReason): Promise<void>;
}

export const ANALYTICS_SESSION_GET_OR_CREATE = 'analytics-session-get-or-create';
export const ANALYTICS_SESSION_TOUCH = 'analytics-session-touch';
export const ANALYTICS_SESSION_RESET = 'analytics-session-reset';
export const ANALYTICS_SESSION_MARK_INACTIVE = 'analytics-session-mark-inactive';

export async function resetRuntimeAnalyticsSession(): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: ANALYTICS_SESSION_RESET,
  });
  if (response?.error) {
    throw new Error(response.error);
  }
}

export class RuntimeAnalyticsSession implements AnalyticsSession {
  async getOrCreate(): Promise<SessionResult> {
    const response = await chrome.runtime.sendMessage({
      type: ANALYTICS_SESSION_GET_OR_CREATE,
    });
    if (!response || typeof response.sessionId !== 'string') {
      throw new Error(response?.error ?? 'Invalid analytics session response');
    }
    return {
      sessionId: response.sessionId,
      isNew: response.isNew === true,
    };
  }

  async touch(): Promise<void> {
    const response = await chrome.runtime.sendMessage({
      type: ANALYTICS_SESSION_TOUCH,
    });
    if (response?.error) {
      throw new Error(response.error);
    }
  }

  async markInactive(reason: SessionEndReason): Promise<void> {
    const response = await chrome.runtime.sendMessage({
      type: ANALYTICS_SESSION_MARK_INACTIVE,
      reason,
    });
    if (response?.error) {
      throw new Error(response.error);
    }
  }
}

export class AnalyticsSessionManager {
  private _sessionId: string | null = null;
  private _lastActivity: number | null = null;
  private _pendingEndReason: SessionEndReason | null = null;
  private readonly _timeoutMs: number;

  constructor(timeoutMs = SESSION_TIMEOUT_MS) {
    this._timeoutMs = timeoutMs;
  }

  getOrCreate(now = Date.now()): SessionResult {
    const isExpired = this._lastActivity !== null && now - this._lastActivity > this._timeoutMs;

    if (this._sessionId === null || isExpired) {
      const endedSession =
        this._sessionId && isExpired
          ? {
              sessionId: this._sessionId,
              reason: this._pendingEndReason ?? ('expiry' as const),
            }
          : undefined;
      this._sessionId = crypto.randomUUID();
      this._lastActivity = now;
      this._pendingEndReason = null;
      return { sessionId: this._sessionId, isNew: true, endedSession };
    }

    this._lastActivity = now;
    this._pendingEndReason = null;
    return { sessionId: this._sessionId, isNew: false };
  }

  touch(now = Date.now()): void {
    if (this._sessionId === null || this._lastActivity === null) return;
    if (now - this._lastActivity > this._timeoutMs) return;
    this._lastActivity = now;
    this._pendingEndReason = null;
  }

  markInactive(reason: SessionEndReason): void {
    if (this._sessionId !== null) {
      this._pendingEndReason = reason;
    }
  }

  reset(): void {
    this._sessionId = null;
    this._lastActivity = null;
    this._pendingEndReason = null;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get lastActivity(): number | null {
    return this._lastActivity;
  }
}

export class AnalyticsSessionService {
  private readonly _manager: AnalyticsSessionManager;

  constructor(manager?: AnalyticsSessionManager) {
    this._manager = manager ?? new AnalyticsSessionManager();
  }

  getOrCreate(now = Date.now()): SessionResult {
    return this._manager.getOrCreate(now);
  }

  touch(now = Date.now()): void {
    this._manager.touch(now);
  }

  markInactive(reason: SessionEndReason): void {
    this._manager.markInactive(reason);
  }

  reset(): void {
    this._manager.reset();
  }
}
