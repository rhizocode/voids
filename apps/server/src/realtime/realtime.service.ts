import { Injectable } from '@nestjs/common';
import {
  WS_EVENTS,
  type JobFinishedEvent,
  type JobProgressEvent,
} from '@voids/shared';

/** A client transport the gateway registers with the service. */
export interface RealtimeSink {
  broadcast(event: string, data: unknown): void;
}

/**
 * Injectable broadcaster the engine/job-runner call to push job events. The
 * WebSocket gateway registers itself as the sink at construction; the service
 * is decoupled from the transport so the engine never imports `ws`.
 */
@Injectable()
export class RealtimeService {
  private sink: RealtimeSink | null = null;

  /** Called by the gateway to wire up the actual transport. */
  registerSink(sink: RealtimeSink): void {
    this.sink = sink;
  }

  emitProgress(event: JobProgressEvent): void {
    this.sink?.broadcast(WS_EVENTS.JOB_PROGRESS, event);
  }

  emitFinished(event: JobFinishedEvent): void {
    this.sink?.broadcast(WS_EVENTS.JOB_FINISHED, event);
  }
}
