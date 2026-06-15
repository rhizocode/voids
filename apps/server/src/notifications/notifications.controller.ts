import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import {
  NotificationProviderId,
  notificationProviderIdSchema,
  type GetNotificationResponse,
  type GetNotificationsResponse,
  type ProviderTestResult,
  type TestResult,
} from '@voids/shared';
import { NotificationRepository } from '../db/repositories/notification.repository';
import { NotificationService } from './notification.service';
import { UpdateNotificationDto } from './dto';

@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly notifications: NotificationService,
  ) {}

  /** All seven provider configs (for the UI to list). Seeds on first read. */
  @Get()
  list(): GetNotificationsResponse {
    return this.repo.list();
  }

  /** Test every ENABLED provider (declared before `:provider` so it matches). */
  @Put('test-all')
  testAll(): Promise<ProviderTestResult[]> {
    return this.notifications.testAll();
  }

  /** A single provider's config. */
  @Get(':provider')
  get(@Param('provider', ParseIntPipe) provider: number): GetNotificationResponse {
    const id = this.parseId(provider);
    const cfg = this.repo.find(id);
    if (!cfg) throw new NotFoundException(`No provider ${id}.`);
    return cfg;
  }

  /** Validate the config against this provider's schema, persist, and return it. */
  @Put(':provider')
  update(
    @Param('provider', ParseIntPipe) provider: number,
    @Body() body: UpdateNotificationDto,
  ): GetNotificationResponse {
    const id = this.parseId(provider);
    if (body.config.id !== id) {
      throw new BadRequestException(
        `config.id (${body.config.id}) does not match provider ${id}.`,
      );
    }
    const updated = this.repo.update(id, {
      enabled: body.enabled,
      config: body.config,
      notificationTypes: body.notificationTypes,
    });
    if (!updated) throw new NotFoundException(`No provider ${id}.`);
    return updated;
  }

  /** Send a TEST notification through this provider; report 70/71. */
  @Put(':provider/test')
  test(@Param('provider', ParseIntPipe) provider: number): Promise<TestResult> {
    const id = this.parseId(provider);
    return this.notifications.test(id);
  }

  private parseId(provider: number): NotificationProviderId {
    const parsed = notificationProviderIdSchema.safeParse(provider);
    if (!parsed.success) {
      throw new NotFoundException(`Unknown provider id ${provider} (expected 0-6).`);
    }
    return parsed.data;
  }
}
