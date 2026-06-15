import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get } from '@nestjs/common';

// Server package version, read at module load. Resolve relative to this file so
// it works from src (dev/test) and dist (production).
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
) as { version: string };

@Controller('api')
export class HealthController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('version')
  version(): { version: string } {
    return { version: pkg.version };
  }
}
