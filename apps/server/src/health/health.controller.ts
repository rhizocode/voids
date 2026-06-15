import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DB } from '../db/db.module';
import type { DbHandle } from '../db/client';

// Server package version, read at module load. Resolve relative to this file so
// it works from src (dev/test) and dist (production).
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
) as { version: string };

@Controller('api')
export class HealthController {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  @Get('health')
  health(): { status: string } {
    try {
      this.handle.sqlite.prepare('select 1').run();
    } catch {
      throw new ServiceUnavailableException({ status: 'error' });
    }
    return { status: 'ok' };
  }

  @Get('version')
  version(): { version: string } {
    return { version: pkg.version };
  }
}
