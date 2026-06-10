import type { OutgoingPayload } from './AnalyticsReporter';

export type AnalyticsEvent = OutgoingPayload['events'][number];
type Deliver = (payload: OutgoingPayload) => Promise<void>;
type Schedule = (flush: () => void) => void;

interface PendingEvent {
  clientId: string;
  event: AnalyticsEvent;
}

export const MAX_BATCHED_EVENTS = 10;

export class AnalyticsEventBatch {
  private readonly _deliver: Deliver;
  private readonly _maxEvents: number;
  private readonly _schedule: Schedule;
  private _pending: PendingEvent[] = [];
  private _flushScheduled = false;
  private _inFlight: Promise<void> | null = null;

  constructor(
    deliver: Deliver,
    maxEvents = MAX_BATCHED_EVENTS,
    schedule: Schedule = (flush) => queueMicrotask(flush)
  ) {
    this._deliver = deliver;
    this._maxEvents = maxEvents;
    this._schedule = schedule;
  }

  enqueue(clientId: string, events: AnalyticsEvent[]): void {
    for (const event of events) {
      if (this._pending.length === this._maxEvents) {
        this._pending.shift();
      }
      this._pending.push({ clientId, event });
    }
    if (this._pending.length === 0 || this._flushScheduled) return;

    this._flushScheduled = true;
    this._schedule(() => {
      void this.flush();
    });
  }

  async flush(): Promise<void> {
    this._flushScheduled = false;
    if (this._inFlight) {
      await this._inFlight;
      if (this._pending.length > 0) {
        await this.flush();
      }
      return;
    }

    const pending = this._pending;
    this._pending = [];
    if (pending.length === 0) return;

    const payloads = new Map<string, AnalyticsEvent[]>();
    for (const { clientId, event } of pending) {
      const events = payloads.get(clientId) ?? [];
      events.push(event);
      payloads.set(clientId, events);
    }

    this._inFlight = Promise.all(
      [...payloads].map(async ([clientId, events]) => {
        try {
          await this._deliver({ client_id: clientId, events });
        } catch {
          // Failed telemetry is intentionally discarded rather than retried or persisted.
        }
      })
    ).then(() => undefined);
    await this._inFlight;
    this._inFlight = null;
  }

  get size(): number {
    return this._pending.length;
  }
}
