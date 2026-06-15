import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common';
import {
  resolveScheduleConfig,
  schedulePresets,
  type ScheduleConfig,
  type SchedulePresetItem,
  type ScheduleRunResponse,
} from '@voids/shared';
import { SettingsService } from '../config/settings.service';
import { SchedulerService } from './scheduler.service';
import { UpdateScheduleDto } from './dto';
import { quartzToCron } from './cron.util';

/**
 * Schedule endpoints (brief §6/§10). The stored `settings.schedule` is the
 * source of truth; `PUT` persists and re-arms the dynamic cron job. `run`
 * triggers a full `SearchAllTask` immediately (the old `/schedule/test`).
 */
@Controller('api/schedule')
export class ScheduleController {
  constructor(
    private readonly settings: SettingsService,
    private readonly scheduler: SchedulerService,
  ) {}

  /** Current schedule config. */
  @Get()
  get(): ScheduleConfig {
    return this.settings.get().schedule;
  }

  /**
   * Update the schedule. The config is normalized (preset cron is forced to
   * match the chosen preset), persisted, and the cron job re-registered. Returns
   * the effective stored schedule.
   */
  @Put()
  update(@Body() body: UpdateScheduleDto): ScheduleConfig {
    let resolved: ScheduleConfig;
    try {
      resolved = resolveScheduleConfig(body as ScheduleConfig);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid schedule config');
    }
    if (resolved.mode === 'custom') {
      try {
        quartzToCron(resolved.cron);
      } catch (err) {
        throw new BadRequestException(err instanceof Error ? err.message : 'Invalid cron expression');
      }
    }
    const updated = this.settings.update({ schedule: resolved });
    this.scheduler.reschedule();
    return updated.schedule;
  }

  /** The built-in preset list (id, label, cron, enabled). */
  @Get('all')
  all(): SchedulePresetItem[] {
    return schedulePresets.map((p) => ({
      id: p.id,
      label: p.label,
      cron: p.cron,
      enabled: p.enabled,
    }));
  }

  /**
   * Trigger a full SearchAllTask run immediately (fire-and-forget). Returns a
   * 202 acknowledgement; progress/results land in the DB as the jobs run.
   */
  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  run(): ScheduleRunResponse {
    // Fire-and-forget: do not await — the run proceeds headless via the job
    // runner. Errors are logged inside the task. The guard in SchedulerService
    // prevents overlap with a concurrent scheduled or manual run.
    void this.scheduler.run();
    return { started: true };
  }
}
