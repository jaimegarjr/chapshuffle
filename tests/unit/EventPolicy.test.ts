import { ALLOWED_EVENT_NAMES, validateEventPayload } from '../../src/analytics/EventPolicy';

describe('validateEventPayload()', () => {
  test('returns null for an undeclared event name', () => {
    expect(validateEventPayload('page_view', {})).toBeNull();
    expect(validateEventPayload('', {})).toBeNull();
    expect(validateEventPayload('shuffle_started', {})).toBeNull();
  });

  test('accepts the declared shuffle_session_started event', () => {
    const result = validateEventPayload('shuffle_session_started', {
      session_id: 'abc',
      engagement_time_msec: 1,
      extension_version: '1.2.3',
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe('shuffle_session_started');
    expect(result!.params).toEqual({
      session_id: 'abc',
      engagement_time_msec: 1,
      extension_version: '1.2.3',
    });
  });

  test('strips undeclared parameter keys', () => {
    const result = validateEventPayload('shuffle_session_started', {
      session_id: 'abc',
      engagement_time_msec: 1,
      video_id: 'dQw4w9WgXcQ', // content-derived — must be stripped
      video_title: 'Rick Astley', // content-derived — must be stripped
      url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', // must be stripped
      undeclared_field: 'value', // must be stripped
    });
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ session_id: 'abc', engagement_time_msec: 1 });
    expect('video_id' in result!.params).toBe(false);
    expect('video_title' in result!.params).toBe(false);
    expect('url' in result!.params).toBe(false);
    expect('undeclared_field' in result!.params).toBe(false);
  });

  test('returns a payload with only the declared params that were provided', () => {
    // Only session_id supplied — engagement_time_msec absent
    const result = validateEventPayload('shuffle_session_started', {
      session_id: 'xyz',
    });
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ session_id: 'xyz' });
    expect('engagement_time_msec' in result!.params).toBe(false);
  });

  test('returns an empty params object when no declared params are provided', () => {
    const result = validateEventPayload('shuffle_session_started', {
      evil_key: 'should-not-appear',
    });
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({});
  });

  test('ALLOWED_EVENT_NAMES includes shuffle_session_started', () => {
    expect(ALLOWED_EVENT_NAMES.has('shuffle_session_started')).toBe(true);
    expect(ALLOWED_EVENT_NAMES.has('shuffled_video_started')).toBe(true);
    expect(ALLOWED_EVENT_NAMES.has('active_playback_heartbeat')).toBe(true);
  });

  test('strips content-derived values from playback volume events', () => {
    expect(
      validateEventPayload('shuffled_video_started', {
        session_id: 'session',
        extension_version: '1.2.3',
        video_id: 'private-video',
        url: 'https://youtube.com/watch?v=private-video',
      })
    ).toEqual({
      name: 'shuffled_video_started',
      params: { session_id: 'session', extension_version: '1.2.3' },
    });
    expect(
      validateEventPayload('active_playback_heartbeat', {
        session_id: 'session',
        active_playback_seconds: 300,
        exact_timestamp: 123456789,
        chapter_name: 'Private chapter',
      })
    ).toEqual({
      name: 'active_playback_heartbeat',
      params: { session_id: 'session', active_playback_seconds: 300 },
    });
  });

  test('ALLOWED_EVENT_NAMES does not include undeclared event names', () => {
    expect(ALLOWED_EVENT_NAMES.has('page_view')).toBe(false);
    expect(ALLOWED_EVENT_NAMES.has('video_started')).toBe(false);
  });
});
