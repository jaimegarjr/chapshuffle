import { AnalyticsSessionManager, SESSION_TIMEOUT_MS } from '../../src/analytics/AnalyticsSession';

describe('AnalyticsSessionManager — getOrCreate()', () => {
  test('creates a new session on first call', () => {
    const mgr = new AnalyticsSessionManager();
    const result = mgr.getOrCreate();
    expect(result.isNew).toBe(true);
    expect(typeof result.sessionId).toBe('string');
    expect(result.sessionId.length).toBeGreaterThan(0);
  });

  test('returns the same session ID within the timeout window', () => {
    const mgr = new AnalyticsSessionManager();
    const t = Date.now();
    const first = mgr.getOrCreate(t);
    const second = mgr.getOrCreate(t + 1000);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.isNew).toBe(false);
  });

  test('creates a new session after the timeout elapses', () => {
    const mgr = new AnalyticsSessionManager();
    const t = Date.now();
    const first = mgr.getOrCreate(t);
    const second = mgr.getOrCreate(t + SESSION_TIMEOUT_MS + 1);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.isNew).toBe(true);
  });

  test('exactly at the timeout boundary is still active', () => {
    const mgr = new AnalyticsSessionManager();
    const t = Date.now();
    const first = mgr.getOrCreate(t);
    // elapsed === timeout → not yet > timeout → still active
    const result = mgr.getOrCreate(t + SESSION_TIMEOUT_MS);
    expect(result.sessionId).toBe(first.sessionId);
    expect(result.isNew).toBe(false);
  });

  test('two consecutive new sessions have distinct IDs', () => {
    const mgr = new AnalyticsSessionManager();
    const t = Date.now();
    const a = mgr.getOrCreate(t);
    const b = mgr.getOrCreate(t + SESSION_TIMEOUT_MS + 1);
    expect(a.sessionId).not.toBe(b.sessionId);
  });
});

describe('AnalyticsSessionManager — touch()', () => {
  test('extends the session beyond the default timeout', () => {
    const mgr = new AnalyticsSessionManager();
    const t = Date.now();
    const first = mgr.getOrCreate(t);

    // Touch just before the timeout would expire
    mgr.touch(t + SESSION_TIMEOUT_MS - 1);

    // Would have expired without the touch; now it should not be new
    const second = mgr.getOrCreate(t + SESSION_TIMEOUT_MS);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.isNew).toBe(false);
  });

  test('has no effect before a session has been created', () => {
    const mgr = new AnalyticsSessionManager();
    mgr.touch(Date.now()); // should not throw or create a session
    expect(mgr.sessionId).toBeNull();
  });

  test('does not revive an already-expired session', () => {
    const mgr = new AnalyticsSessionManager();
    const t = Date.now();
    const first = mgr.getOrCreate(t);

    // Activity tick arrives after the session already expired
    mgr.touch(t + SESSION_TIMEOUT_MS + 1);

    const second = mgr.getOrCreate(t + SESSION_TIMEOUT_MS + 2);
    expect(second.isNew).toBe(true);
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  test('continuous touches keep one session alive far beyond the timeout', () => {
    const mgr = new AnalyticsSessionManager();
    const t = Date.now();
    const first = mgr.getOrCreate(t);

    // Simulate >60 minutes of qualifying playback refreshed in half-timeout steps
    const step = SESSION_TIMEOUT_MS / 2;
    for (let i = 1; i <= 5; i++) {
      mgr.touch(t + step * i);
    }

    const second = mgr.getOrCreate(t + step * 5 + 1);
    expect(second.isNew).toBe(false);
    expect(second.sessionId).toBe(first.sessionId);
  });
});

describe('AnalyticsSessionManager — reset()', () => {
  test('causes the next getOrCreate to start a fresh session', () => {
    const mgr = new AnalyticsSessionManager();
    const t = Date.now();
    const first = mgr.getOrCreate(t);
    mgr.reset();
    const second = mgr.getOrCreate(t + 1);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.isNew).toBe(true);
  });

  test('clears sessionId and lastActivity', () => {
    const mgr = new AnalyticsSessionManager();
    mgr.getOrCreate(Date.now());
    mgr.reset();
    expect(mgr.sessionId).toBeNull();
    expect(mgr.lastActivity).toBeNull();
  });
});

describe('AnalyticsSessionManager — custom timeout', () => {
  test('session is still active before the custom timeout', () => {
    const mgr = new AnalyticsSessionManager(5_000);
    const t = Date.now();
    const first = mgr.getOrCreate(t);
    const second = mgr.getOrCreate(t + 4_999);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.isNew).toBe(false);
  });

  test('session expires after the custom timeout elapses', () => {
    const mgr = new AnalyticsSessionManager(5_000);
    const t = Date.now();
    const first = mgr.getOrCreate(t);
    // Jump past the timeout in one step (no intermediate call that would reset _lastActivity)
    const expired = mgr.getOrCreate(t + 5_001);
    expect(expired.sessionId).not.toBe(first.sessionId);
    expect(expired.isNew).toBe(true);
  });
});
