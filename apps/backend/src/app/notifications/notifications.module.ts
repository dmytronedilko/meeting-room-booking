import { Module } from '@nestjs/common';

import { MetricsModule } from '../metrics/metrics.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [MetricsModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
