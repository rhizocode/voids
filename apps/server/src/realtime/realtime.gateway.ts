import { Logger } from '@nestjs/common';
import {
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, WebSocket } from 'ws';
import { WS_EVENTS, jobCancelMessageSchema } from '@voids/shared';
import { JobRunnerService } from '../search/job-runner.service';
import { RealtimeService, type RealtimeSink } from './realtime.service';

/**
 * WebSocket gateway on path `/ws`. Uses the `ws` adapter (wired in main.ts).
 * Messages use a JSON envelope `{ event, data }`; the adapter routes inbound
 * frames by their `event` field to `@SubscribeMessage` handlers, and
 * `broadcast` writes the same envelope outbound to every connected client.
 */
@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway implements OnGatewayInit, RealtimeSink {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jobRunner: JobRunnerService,
  ) {}

  afterInit(): void {
    this.realtime.registerSink(this);
  }

  /** Broadcast a `{ event, data }` envelope to all open clients. */
  broadcast(event: string, data: unknown): void {
    if (!this.server) return;
    const message = JSON.stringify({ event, data });
    for (const client of this.server.clients as Set<WebSocket>) {
      // 1 === WebSocket.OPEN
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  /** client -> server: `job:cancel { jobId }`. */
  @SubscribeMessage(WS_EVENTS.JOB_CANCEL)
  handleCancel(@MessageBody() data: unknown): void {
    const parsed = jobCancelMessageSchema.safeParse(data);
    if (!parsed.success) {
      this.logger.warn('Received invalid job:cancel message');
      return;
    }
    this.jobRunner.requestCancel(parsed.data.jobId);
  }
}
