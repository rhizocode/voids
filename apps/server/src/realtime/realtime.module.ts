import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';

/**
 * The gateway needs `JobRunnerService` (in SearchModule) to handle `job:cancel`,
 * while SearchModule needs `RealtimeService` to broadcast — a forwardRef breaks
 * the cycle. `RealtimeService` is exported for the engine; the gateway registers
 * itself as the broadcast sink on init.
 */
@Module({
  imports: [AuthModule, forwardRef(() => SearchModule)],
  providers: [RealtimeService, RealtimeGateway],
  exports: [RealtimeService],
})
export class RealtimeModule {}
