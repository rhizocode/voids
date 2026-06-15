import { Module } from '@nestjs/common';
import { NotificationRepository } from '../db/repositories/notification.repository';
import { SettingsModule } from '../config/settings.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [SettingsModule],
  controllers: [AdminController],
  providers: [AdminService, NotificationRepository],
})
export class AdminModule {}
