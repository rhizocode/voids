import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

const WWW_AUTHENTICATE = 'Basic realm="Voids", charset="UTF-8"';

/**
 * Global HTTP Basic auth guard.
 *
 * - `none` mode: a complete no-op (returns true for everything) — preserves the
 *   prior trusted-LAN behavior.
 * - `basic` mode: requires valid Basic credentials on all routes EXCEPT the
 *   public exemptions below, so Radarr can keep reading RSS and container
 *   healthchecks keep working without credentials.
 *
 * On failure it returns 401 with `WWW-Authenticate: Basic` so browsers show the
 * native login prompt (no custom login page needed).
 *
 * Exempt routes:
 *   - `/rss/**`          (feeds must stay public for Radarr)
 *   - `GET /api/health`  (container healthchecks)
 *   - `GET /api/auth/mode` (lets the UI discover whether auth is on)
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.auth.mode !== 'basic') return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (isExempt(req)) return true;

    const credentials = parseBasicAuth(req.headers.authorization);
    if (credentials && this.auth.validate(credentials.username, credentials.password)) {
      return true;
    }

    res.setHeader('WWW-Authenticate', WWW_AUTHENTICATE);
    throw new UnauthorizedException('Authentication required.');
  }
}

/** Routes that remain reachable without credentials, even in basic mode. */
function isExempt(req: Request): boolean {
  const method = req.method.toUpperCase();
  // Use the raw path (strip any query string) for matching.
  const path = (req.path ?? req.url).split('?')[0];

  if (path.startsWith('/rss/') || path === '/rss') return true;
  if (method === 'GET' && path === '/api/health') return true;
  if (method === 'GET' && path === '/api/auth/mode') return true;
  return false;
}

interface BasicCredentials {
  username: string;
  password: string;
}

/** Parse an `Authorization: Basic base64(user:pass)` header. */
function parseBasicAuth(header: string | undefined): BasicCredentials | null {
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
  return {
    username: decoded.slice(0, sep),
    password: decoded.slice(sep + 1),
  };
}
