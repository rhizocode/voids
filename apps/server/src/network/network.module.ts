import { Module } from '@nestjs/common';
import { SettingsModule } from '../config/settings.module';
import { NetworkController } from './network.controller';

@Module({
  imports: [SettingsModule],
  controllers: [NetworkController],
})
export class NetworkModule {}
