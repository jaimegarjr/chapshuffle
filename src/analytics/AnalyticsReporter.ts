import { createDebugLogger } from '../debug/DebugLogger';
import { getConsent, getOrCreateInstallId } from './ConsentManager';
import { AnalyticsSessionManager } from './AnalyticsSession';
import { validateEventPayload } from './EventPolicy';

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
async function sendToGA4(payload: OutgoingPayload): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'ga4-deliver', payload });
  if (response?.error) {
    debug.log(`GA4 delivery failed: ${response.error}`);
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
  private readonly _session: AnalyticsSessionManager;

  constructor(session?: AnalyticsSessionManager) {
    this._session = session ?? new AnalyticsSessionManager();
  }

  /**
   * Call when eligible Chap Shuffle playback begins (Auto-advance on, video actively playing).
   * Consent is checked first — nothing happens without explicit opt-in.
   * All errors are swallowed to ensure telemetry never disrupts playback.
   */
  async notifyEligiblePlayback(): Promise<void> {
    try {
      const hasConsent = await getConsent();
      if (!hasConsent) {
        debug.log('telemetry skipped — no consent');
        return;
      }

      const installId = await getOrCreateInstallId();
      const { sessionId, isNew } = this._session.getOrCreate();

      if (!isNew) {
        debug.log('analytics session still active — no event emitted');
        return;
      }

      const validated = validateEventPayload('shuffle_session_started', {
        session_id: sessionId,
        engagement_time_msec: 1,
        extension_version: chrome.runtime.getManifest().version,
      });

      if (!validated) {
        debug.log('event validation failed — skipping');
        return;
      }

      const payload: OutgoingPayload = {
        client_id: installId,
        events: [{ name: validated.name, params: validated.params }],
      };

      debug.log('validated telemetry payload:', JSON.stringify(payload));

      await sendToGA4(payload);
      debug.log('shuffle_session_started delivered to GA4');
    } catch (err) {
      debug.log('telemetry error (non-blocking):', err);
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
      const { sessionId } = this._session.getOrCreate();
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

  touchSession(): void {
    this._session.touch();
  }
}

export const analyticsReporter = new AnalyticsReporter();
