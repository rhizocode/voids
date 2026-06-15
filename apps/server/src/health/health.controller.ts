import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DB } from '../db/db.module';
import type { DbHandle } from '../db/client';

// Single source of truth for the reported version: the release script derives it
// from the git tag and passes it in via APP_VERSION. Fall back to the package.json
// version (read at module load, resolved relative to this file so it works from src
// in dev/test and dist in production) for untagged / local runs.
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
) as { version: string };
const appVersion = process.env.APP_VERSION ?? pkg.version;

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
    return { version: appVersion };
  }
}
