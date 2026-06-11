import { settings } from './persistence/PersistenceManager';
import type { OutgoingPayload } from './analytics/AnalyticsReporter';
import {
  ANALYTICS_SESSION_GET_OR_CREATE,
  ANALYTICS_SESSION_MARK_INACTIVE,
  ANALYTICS_SESSION_RESET,
  ANALYTICS_SESSION_TOUCH,
  AnalyticsSessionService,
} from './analytics/AnalyticsSession';

// GA4 Measurement Protocol credentials injected at build time.
declare const __GA_MEASUREMENT_ID__: string | undefined;
declare const __GA_API_SECRET__: string | undefined;
declare const __GA_DEBUG_ENABLED__: boolean;

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA4_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const analyticsSession = new AnalyticsSessionService();

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

function applyBadge(enabled: boolean): void {
  chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#cc0000' : '#888888' });
}

function applyLiveBadge(): void {
  chrome.action.setBadgeText({ text: 'LIVE' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff6600' });
}

settings.read().then(({ shuffleEnabled }) => applyBadge(shuffleEnabled));

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    settings.update({ shuffleEnabled: true }).then(() => applyBadge(true));
    chrome.tabs.create({ url: 'https://jaimegarjr.github.io/chapshuffle/' });
  }
});

settings.subscribe(({ shuffleEnabled }) => {
  if (shuffleEnabled !== undefined) {
    applyBadge(shuffleEnabled);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'livestream-detected') {
    applyLiveBadge();
  } else if (msg?.type === 'livestream-left') {
    settings.read().then(({ shuffleEnabled }) => applyBadge(shuffleEnabled));
  } else if (msg?.type === ANALYTICS_SESSION_GET_OR_CREATE) {
    sendResponse(analyticsSession.getOrCreate());
  } else if (msg?.type === ANALYTICS_SESSION_TOUCH) {
    analyticsSession.touch();
    sendResponse({});
  } else if (msg?.type === ANALYTICS_SESSION_RESET) {
    analyticsSession.reset();
    sendResponse({});
  } else if (msg?.type === ANALYTICS_SESSION_MARK_INACTIVE) {
    if (msg.reason === 'navigation_away' || msg.reason === 'tab_closed') {
      analyticsSession.markInactive(msg.reason);
      sendResponse({});
    } else {
      sendResponse({ error: 'invalid session end reason' });
    }
  } else if (msg?.type === 'ga4-deliver') {
    const credentials = readCredentials();
    if (!credentials) {
      sendResponse({ error: 'no credentials configured' });
      return false;
    }
    const url = `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(credentials.measurementId)}&api_secret=${encodeURIComponent(credentials.apiSecret)}`;
    fetch(url, { method: 'POST', body: JSON.stringify(msg.payload as OutgoingPayload) })
      .then((r) => sendResponse(r.ok ? {} : { error: `HTTP ${r.status}` }))
      .catch((err: unknown) =>
        sendResponse({ error: err instanceof Error ? err.message : String(err) })
      );
    return true; // keep message channel open for async response
  } else if (msg?.type === 'ga4-debug-validate') {
    if (!__GA_DEBUG_ENABLED__) {
      sendResponse({ error: 'debug validation is disabled in this build' });
      return false;
    }
    const credentials = readCredentials();
    if (!credentials) {
      sendResponse({ error: 'no credentials configured' });
      return false;
    }
    const url = `${GA4_DEBUG_ENDPOINT}?measurement_id=${encodeURIComponent(credentials.measurementId)}&api_secret=${encodeURIComponent(credentials.apiSecret)}`;
    fetch(url, { method: 'POST', body: JSON.stringify(msg.payload as OutgoingPayload) })
      .then((r) => r.json())
      .then((result) => sendResponse({ result }))
      .catch((err: unknown) =>
        sendResponse({ error: err instanceof Error ? err.message : String(err) })
      );
    return true;
  }
});
