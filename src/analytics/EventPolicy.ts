// Strict allowlist: only declared event names and parameter keys may appear in outgoing payloads.
// Content-derived values (video IDs, URLs, titles, chapter names, timestamps) are never allowed.

export type AllowedEventName =
  | 'shuffle_session_started'
  | 'shuffled_video_started'
  | 'active_playback_heartbeat'
  | 'chapter_completed'
  | 'chapter_skipped'
  | 'reshuffle_used'
  | 'exclusions_updated'
  | 'loop_toggled'
  | 'queue_reordered'
  | 'session_ended'
  | 'feedback_link_opened';

const ALLOWED_PARAMS: Record<AllowedEventName, ReadonlySet<string>> = {
  shuffle_session_started: new Set(['session_id', 'engagement_time_msec', 'extension_version']),
  shuffled_video_started: new Set(['session_id', 'extension_version']),
  active_playback_heartbeat: new Set([
    'session_id',
    'active_playback_seconds',
    'extension_version',
  ]),
  chapter_completed: new Set(['session_id', 'queue_position', 'queue_length', 'extension_version']),
  chapter_skipped: new Set([
    'session_id',
    'queue_position',
    'target_position',
    'queue_length',
    'extension_version',
  ]),
  reshuffle_used: new Set(['session_id', 'extension_version']),
  exclusions_updated: new Set(['session_id', 'excluded_count', 'extension_version']),
  loop_toggled: new Set(['session_id', 'enabled', 'extension_version']),
  queue_reordered: new Set([
    'session_id',
    'from_position',
    'to_position',
    'queue_length',
    'extension_version',
  ]),
  session_ended: new Set(['session_id', 'end_reason', 'extension_version']),
  feedback_link_opened: new Set(['extension_version']),
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
