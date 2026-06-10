import { createDebugLogger } from '../debug/DebugLogger';
import { getConsent, getOrCreateInstallId } from './ConsentManager';
import { type AnalyticsSession, RuntimeAnalyticsSession } from './AnalyticsSession';
import { validateEventPayload } from './EventPolicy';
import { AnalyticsEventBatch, type AnalyticsEvent } from './AnalyticsEventBatch';

const debug = createDebugLogger('analytics');

export interface OutgoingPayload {
  client_id: string;
  events: Array<{ name: string; params: Record<string, unknown> }>;
}

/**
 * Asks the background service worker to deliver a payload to GA4.
 * The background holds the credentials and makes the actual fetch,
 * since content scripts cannot make cross-origin requests directly.
 */
export async function sendToGA4(payload: OutgoingPayload): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'ga4-deliver', payload });
  if (response?.error) {
    throw new Error(response.error);
  }
}

async function validateWithDebugEndpoint(payload: OutgoingPayload): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'ga4-debug-validate', payload });
  if (response?.result) {
    debug.log('GA4 debug validation response:', JSON.stringify(response.result));
  } else if (response?.error) {
    debug.log(`GA4 debug endpoint error: ${response.error}`);
  }
}

export class AnalyticsReporter {
  private readonly _session: AnalyticsSession;
  private readonly _batch: AnalyticsEventBatch;

  constructor(session?: AnalyticsSession, batch?: AnalyticsEventBatch) {
    this._session = session ?? new RuntimeAnalyticsSession();
    this._batch =
      batch ??
      new AnalyticsEventBatch(async (payload) => {
        if (await getConsent()) {
          await sendToGA4(payload);
        }
      });
  }

  /**
   * Call when eligible Chap Shuffle playback begins (Auto-advance on, video actively playing).
   * Consent is checked first — nothing happens without explicit opt-in.
   * All errors are swallowed to ensure telemetry never disrupts playback.
   */
  async notifyEligiblePlayback(videoSessionId: string | null = null): Promise<string | null> {
    try {
      const hasConsent = await getConsent();
      if (!hasConsent) {
        debug.log('telemetry skipped — no consent');
        return null;
      }

      const installId = await getOrCreateInstallId();
      const { sessionId, isNew } = await this._session.getOrCreate();
      const events: AnalyticsEvent[] = [];

      if (isNew) {
        const sessionStarted = validateEventPayload('shuffle_session_started', {
          session_id: sessionId,
          engagement_time_msec: 1,
          extension_version: chrome.runtime.getManifest().version,
        });
        if (sessionStarted) events.push(sessionStarted);
      }

      if (videoSessionId !== sessionId) {
        const videoStarted = validateEventPayload('shuffled_video_started', {
          session_id: sessionId,
          extension_version: chrome.runtime.getManifest().version,
        });
        if (videoStarted) events.push(videoStarted);
      }

      if (events.length === 0) {
        debug.log('session and video already tracked — no event emitted');
      }
      this._batch.enqueue(installId, events);
      return sessionId;
    } catch (err) {
      debug.log('telemetry error (non-blocking):', err);
      return null;
    }
  }

  async notifyActivePlayback(
    activePlaybackMs: number,
    videoSessionId: string | null
  ): Promise<string | null> {
    try {
      const hasConsent = await getConsent();
      if (!hasConsent) return null;

      const installId = await getOrCreateInstallId();
      const { sessionId, isNew } = await this._session.getOrCreate();
      const events: AnalyticsEvent[] = [];

      if (isNew) {
        const sessionStarted = validateEventPayload('shuffle_session_started', {
          session_id: sessionId,
          engagement_time_msec: 1,
          extension_version: chrome.runtime.getManifest().version,
        });
        if (sessionStarted) events.push(sessionStarted);
      }

      if (videoSessionId !== sessionId) {
        const videoStarted = validateEventPayload('shuffled_video_started', {
          session_id: sessionId,
          extension_version: chrome.runtime.getManifest().version,
        });
        if (videoStarted) events.push(videoStarted);
      }

      const heartbeat = validateEventPayload('active_playback_heartbeat', {
        session_id: sessionId,
        active_playback_seconds: Math.round(activePlaybackMs / 1000),
        extension_version: chrome.runtime.getManifest().version,
      });
      if (heartbeat) events.push(heartbeat);

      this._batch.enqueue(installId, events);
      return sessionId;
    } catch (err) {
      debug.log('active playback telemetry error (non-blocking):', err);
      return null;
    }
  }

  /**
   * Validates a payload against the GA4 debug endpoint. Only useful during development.
   * Requires credentials to be configured.
   */
  async debugValidate(): Promise<void> {
    try {
      const hasConsent = await getConsent();
      if (!hasConsent) {
        debug.log('debug validation skipped — no consent');
        return;
      }
      const installId = await getOrCreateInstallId();
      const { sessionId } = await this._session.getOrCreate();
      const validated = validateEventPayload('shuffle_session_started', {
        session_id: sessionId,
        engagement_time_msec: 1,
        extension_version: chrome.runtime.getManifest().version,
      });
      if (!validated) return;
      const payload: OutgoingPayload = {
        client_id: installId,
        events: [{ name: validated.name, params: validated.params }],
      };
      await validateWithDebugEndpoint(payload);
    } catch (err) {
      debug.log('debug validation error:', err);
    }
  }

  async touchSession(): Promise<void> {
    try {
      await this._session.touch();
    } catch (err) {
      debug.log('analytics session refresh error:', err);
    }
  }

  async flush(): Promise<void> {
    await this._batch.flush();
  }
}

export const analyticsReporter = new AnalyticsReporter();
