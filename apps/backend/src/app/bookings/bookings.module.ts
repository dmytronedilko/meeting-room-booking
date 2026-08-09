import { Module } from '@nestjs/common';

import { MetricsModule } from '../metrics/metrics.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [MetricsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
