import { Logger } from '@nestjs/common';
import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type { Server, WebSocket } from 'ws';
import { WS_EVENTS, jobCancelMessageSchema } from '@voids/shared';
import { AuthService } from '../auth/auth.service';
import { JobRunnerService } from '../search/job-runner.service';
import { RealtimeService, type RealtimeSink } from './realtime.service';

/**
 * WebSocket gateway on path `/ws`. Uses the `ws` adapter (wired in main.ts).
 * Messages use a JSON envelope `{ event, data }`; the adapter routes inbound
 * frames by their `event` field to `@SubscribeMessage` handlers, and
 * `broadcast` writes the same envelope outbound to every connected client.
 */
@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, RealtimeSink {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jobRunner: JobRunnerService,
    private readonly auth: AuthService,
  ) {}

  afterInit(): void {
    this.realtime.registerSink(this);
  }

  /** Reject the upgrade if basic auth is enabled and credentials are invalid. */
  handleConnection(client: WebSocket, req: IncomingMessage): void {
    if (this.auth.mode !== 'basic') return;

    const header = req.headers['authorization'];
    const credentials = parseBasicAuth(header);
    if (credentials && this.auth.validate(credentials.username, credentials.password)) {
      return;
    }

    client.close(1008, 'Unauthorized');
  }

  /** Broadcast a `{ event, data }` envelope to all open clients. */
  broadcast(event: string, data: unknown): void {
    if (!this.server) return;
    const message = JSON.stringify({ event, data });
    for (const client of this.server.clients as Set<WebSocket>) {
      // 1 === WebSocket.OPEN
      if (client.readyState === 1) {
        try {
          client.send(message);
        } catch (err) {
          this.logger.warn(`broadcast send failed: ${err}`);
        }
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

function parseBasicAuth(header: string | undefined): { username: string; password: string } | null {
  if (!header) return null;
  const [scheme, encoded] = header.split(' ');
  if (!encoded || scheme.toLowerCase() !== 'basic') return null;
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return null;
  }
  const sep = decoded.indexOf(':');
  if (sep === -1) return null;
  return { username: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
}
