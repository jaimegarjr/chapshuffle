// Strict allowlist: only declared event names and parameter keys may appear in outgoing payloads.
// Content-derived values (video IDs, URLs, titles, chapter names, timestamps) are never allowed.

export type AllowedEventName = 'shuffle_session_started';

const ALLOWED_PARAMS: Record<AllowedEventName, ReadonlySet<string>> = {
  shuffle_session_started: new Set(['session_id', 'engagement_time_msec']),
};

export const ALLOWED_EVENT_NAMES: ReadonlySet<string> = new Set(
  Object.keys(ALLOWED_PARAMS) as AllowedEventName[]
);

export interface ValidatedEventPayload {
  name: AllowedEventName;
  params: Record<string, unknown>;
}

/**
 * Validates an event name and strips any parameters not on the allowlist.
 * Returns null if the event name is not declared.
 * Undeclared parameter keys are silently dropped — content-derived data cannot enter a payload.
 */
export function validateEventPayload(
  name: string,
  rawParams: Record<string, unknown>
): ValidatedEventPayload | null {
  if (!ALLOWED_EVENT_NAMES.has(name)) return null;

  const eventName = name as AllowedEventName;
  const allowedKeys = ALLOWED_PARAMS[eventName];
  const safeParams: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (key in rawParams) {
      safeParams[key] = rawParams[key];
    }
  }

  return { name: eventName, params: safeParams };
}
