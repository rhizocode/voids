import { Controller, Get } from '@nestjs/common';
import type { AuthModeResponse } from '@voids/shared';
import { AuthService } from './auth.service';

/**
 * Public-ish auth metadata. Tells the UI whether auth is enabled without ever
 * revealing the username or password. Exempt from the guard (see AuthGuard).
 */
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('mode')
  mode(): AuthModeResponse {
    return { mode: this.auth.mode };
  }
}
