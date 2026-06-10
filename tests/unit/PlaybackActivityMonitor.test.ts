import {
  ACTIVE_PLAYBACK_HEARTBEAT_MS,
  ACTIVITY_REFRESH_INTERVAL_MS,
  PlaybackActivityMonitor,
} from '../../src/analytics/PlaybackActivityMonitor';

function buildVideo(initial: { paused?: boolean; ended?: boolean } = {}) {
  const listeners = new Map<string, Set<() => void>>();
  return {
    paused: initial.paused ?? true,
    ended: initial.ended ?? false,
    addEventListener(type: string, listener: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('PlaybackActivityMonitor', () => {
  test('does not tick while the video is paused', () => {
    const video = buildVideo({ paused: true });
    const onActivity = jest.fn();
    new PlaybackActivityMonitor(video, onActivity).start();

    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS * 3);
    expect(onActivity).not.toHaveBeenCalled();
  });

  test('ticks every interval when the video is already playing at start', () => {
    const video = buildVideo({ paused: false });
    const onActivity = jest.fn();
    new PlaybackActivityMonitor(video, onActivity).start();

    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS * 3);
    expect(onActivity).toHaveBeenCalledTimes(3);
  });

  test('does not tick before a full interval has elapsed', () => {
    const video = buildVideo({ paused: false });
    const onActivity = jest.fn();
    new PlaybackActivityMonitor(video, onActivity).start();

    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS - 1);
    expect(onActivity).not.toHaveBeenCalled();
  });

  test('a playing event begins ticking', () => {
    const video = buildVideo({ paused: true });
    const onActivity = jest.fn();
    new PlaybackActivityMonitor(video, onActivity).start();

    video.emit('playing');
    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS);
    expect(onActivity).toHaveBeenCalledTimes(1);
  });

  test('a pause event stops ticking', () => {
    const video = buildVideo({ paused: false });
    const onActivity = jest.fn();
    new PlaybackActivityMonitor(video, onActivity).start();

    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS);
    video.emit('pause');
    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS * 2);
    expect(onActivity).toHaveBeenCalledTimes(1);
  });

  test('an ended event stops ticking', () => {
    const video = buildVideo({ paused: false });
    const onActivity = jest.fn();
    new PlaybackActivityMonitor(video, onActivity).start();

    video.emit('ended');
    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS * 2);
    expect(onActivity).not.toHaveBeenCalled();
  });

  test('repeated playing events do not double the tick rate', () => {
    const video = buildVideo({ paused: false });
    const onActivity = jest.fn();
    new PlaybackActivityMonitor(video, onActivity).start();

    video.emit('playing');
    video.emit('playing');
    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS);
    expect(onActivity).toHaveBeenCalledTimes(1);
  });

  test('stop() halts ticking and detaches listeners', () => {
    const video = buildVideo({ paused: false });
    const onActivity = jest.fn();
    const monitor = new PlaybackActivityMonitor(video, onActivity);
    monitor.start();

    monitor.stop();
    video.emit('playing');
    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS * 2);
    expect(onActivity).not.toHaveBeenCalled();
  });

  test('emits a coarse heartbeat after five accumulated active minutes', () => {
    const video = buildVideo({ paused: false });
    const onHeartbeat = jest.fn();
    new PlaybackActivityMonitor(
      video,
      jest.fn(),
      ACTIVITY_REFRESH_INTERVAL_MS,
      onHeartbeat
    ).start();

    jest.advanceTimersByTime(ACTIVE_PLAYBACK_HEARTBEAT_MS);

    expect(onHeartbeat).toHaveBeenCalledWith(ACTIVE_PLAYBACK_HEARTBEAT_MS);
    expect(onHeartbeat).toHaveBeenCalledTimes(1);
  });

  test('paused time is excluded while partial active time carries forward', () => {
    const video = buildVideo({ paused: false });
    const onHeartbeat = jest.fn();
    new PlaybackActivityMonitor(
      video,
      jest.fn(),
      ACTIVITY_REFRESH_INTERVAL_MS,
      onHeartbeat
    ).start();

    jest.advanceTimersByTime(ACTIVE_PLAYBACK_HEARTBEAT_MS - ACTIVITY_REFRESH_INTERVAL_MS);
    video.emit('pause');
    jest.advanceTimersByTime(ACTIVE_PLAYBACK_HEARTBEAT_MS);
    expect(onHeartbeat).not.toHaveBeenCalled();

    video.emit('playing');
    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS);
    expect(onHeartbeat).toHaveBeenCalledTimes(1);
  });

  test('buffering time is excluded until playback resumes', () => {
    const video = buildVideo({ paused: false });
    const onHeartbeat = jest.fn();
    new PlaybackActivityMonitor(
      video,
      jest.fn(),
      ACTIVITY_REFRESH_INTERVAL_MS,
      onHeartbeat
    ).start();

    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS * 2);
    video.emit('waiting');
    jest.advanceTimersByTime(ACTIVE_PLAYBACK_HEARTBEAT_MS);
    expect(onHeartbeat).not.toHaveBeenCalled();

    video.emit('playing');
    jest.advanceTimersByTime(ACTIVITY_REFRESH_INTERVAL_MS * 3);
    expect(onHeartbeat).toHaveBeenCalledTimes(1);
  });

  test('hidden-tab audio playback still accumulates active time', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    const video = buildVideo({ paused: false });
    const onHeartbeat = jest.fn();
    new PlaybackActivityMonitor(
      video,
      jest.fn(),
      ACTIVITY_REFRESH_INTERVAL_MS,
      onHeartbeat
    ).start();

    jest.advanceTimersByTime(ACTIVE_PLAYBACK_HEARTBEAT_MS);

    expect(onHeartbeat).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
});
