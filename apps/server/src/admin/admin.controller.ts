import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { PayloadResult } from '@voids/shared';
import { AdminService } from './admin.service';
import { NukeDto } from './dto';

/**
 * Admin endpoints. `POST /api/nuke` is the destructive reset. Guarded by the
 * global AuthGuard like every other `/api/**` route. Health/version live in the
 * health module and are intentionally left as-is (health stays public).
 */
@Controller('api')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('nuke')
  @HttpCode(HttpStatus.OK)
  nuke(@Body() _body: NukeDto): PayloadResult {
    return this.admin.nuke();
  }
}
