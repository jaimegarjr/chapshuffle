import { createDebugLogger } from '../debug/DebugLogger';
import { getConsent, getOrCreateInstallId } from './ConsentManager';
import { AnalyticsSessionManager } from './AnalyticsSession';
import { validateEventPayload } from './EventPolicy';

const debug = createDebugLogger('analytics');

// Injected at build time by esbuild define. Absent (undefined) in builds without credentials.
declare const __GA_MEASUREMENT_ID__: string | undefined;
declare const __GA_API_SECRET__: string | undefined;

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA4_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';

export interface OutgoingPayload {
  client_id: string;
  events: Array<{ name: string; params: Record<string, unknown> }>;
}

/**
 * Reads GA4 credentials from build-time constants.
 * Returns null if either is absent — telemetry is silently disabled rather than erroring.
 */
function readCredentials(): { measurementId: string; apiSecret: string } | null {
  const mid =
    typeof __GA_MEASUREMENT_ID__ !== 'undefined' && __GA_MEASUREMENT_ID__
      ? __GA_MEASUREMENT_ID__
      : null;
  const secret =
    typeof __GA_API_SECRET__ !== 'undefined' && __GA_API_SECRET__ ? __GA_API_SECRET__ : null;

  if (!mid || !secret) return null;
  return { measurementId: mid, apiSecret: secret };
}

async function sendToGA4(
  payload: OutgoingPayload,
  measurementId: string,
  apiSecret: string
): Promise<void> {
  const url = `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    debug.log(`GA4 delivery failed — HTTP ${response.status}`);
  }
}

async function validateWithDebugEndpoint(
  payload: OutgoingPayload,
  measurementId: string,
  apiSecret: string
): Promise<void> {
  const url = `${GA4_DEBUG_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (response.ok) {
    const body = await response.json();
    debug.log('GA4 debug validation response:', JSON.stringify(body));
  } else {
    debug.log(`GA4 debug endpoint returned HTTP ${response.status}`);
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

      const credentials = readCredentials();
      if (!credentials) {
        debug.log('no GA4 credentials configured — local sink only');
        return;
      }

      await sendToGA4(payload, credentials.measurementId, credentials.apiSecret);
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
      const credentials = readCredentials();
      if (!credentials) {
        debug.log('debug validation skipped — no credentials');
        return;
      }
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
      });
      if (!validated) return;
      const payload: OutgoingPayload = {
        client_id: installId,
        events: [{ name: validated.name, params: validated.params }],
      };
      await validateWithDebugEndpoint(payload, credentials.measurementId, credentials.apiSecret);
    } catch (err) {
      debug.log('debug validation error:', err);
    }
  }

  touchSession(): void {
    this._session.touch();
  }
}

export const analyticsReporter = new AnalyticsReporter();
