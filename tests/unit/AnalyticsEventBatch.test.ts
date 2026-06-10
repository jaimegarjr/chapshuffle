import {
  AnalyticsEventBatch,
  MAX_BATCHED_EVENTS,
  type AnalyticsEvent,
} from '../../src/analytics/AnalyticsEventBatch';

function event(name: string): AnalyticsEvent {
  return { name, params: {} };
}

describe('AnalyticsEventBatch', () => {
  test('coalesces queued events into one in-memory delivery', async () => {
    const deliver = jest.fn().mockResolvedValue(undefined);
    let scheduled: (() => void) | null = null;
    const batch = new AnalyticsEventBatch(deliver, MAX_BATCHED_EVENTS, (flush) => {
      scheduled = flush;
    });

    batch.enqueue('client', [event('first')]);
    batch.enqueue('client', [event('second')]);
    expect(batch.size).toBe(2);

    scheduled!();
    await Promise.resolve();

    expect(deliver).toHaveBeenCalledWith({
      client_id: 'client',
      events: [event('first'), event('second')],
    });
    expect(batch.size).toBe(0);
  });

  test('keeps only the newest events when the batch reaches its bound', async () => {
    const deliver = jest.fn().mockResolvedValue(undefined);
    let scheduled: (() => void) | null = null;
    const batch = new AnalyticsEventBatch(deliver, 2, (flush) => {
      scheduled = flush;
    });

    batch.enqueue('client', [event('oldest'), event('middle'), event('newest')]);
    scheduled!();
    await Promise.resolve();

    expect(deliver).toHaveBeenCalledWith({
      client_id: 'client',
      events: [event('middle'), event('newest')],
    });
  });

  test('discards a failed delivery without retrying or retaining events', async () => {
    const deliver = jest.fn().mockRejectedValue(new Error('offline'));
    const batch = new AnalyticsEventBatch(deliver);

    batch.enqueue('client', [event('heartbeat')]);
    await batch.flush();
    await Promise.resolve();

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(batch.size).toBe(0);
  });
});
