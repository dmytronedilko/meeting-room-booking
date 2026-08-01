import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  CreateBookingResponse,
  MyBookingDto,
  MyNotificationDto,
  PastBookingsPageDto,
} from '@office/shared';

import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PastBookingsQueryDto } from './dto/past-bookings-query.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Book a room slot (optionally repeating weekly)' })
  @ApiResponse({ status: 201, description: 'Booking (or weekly series) created' })
  @ApiResponse({ status: 400, description: 'Slot violates booking rules' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 409, description: 'Slot overlaps an existing booking' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBookingDto,
  ): Promise<CreateBookingResponse> {
    return this.bookingsService.create(user.sub, dto);
  }

  @Get('my/upcoming')
  @ApiOperation({ summary: 'Own upcoming bookings, nearest first' })
  findMyUpcoming(@CurrentUser() user: JwtPayload): Promise<MyBookingDto[]> {
    return this.bookingsService.findMyUpcoming(user.sub);
  }

  @Get('my/past')
  @ApiOperation({ summary: 'Own past bookings, most recent first (paginated)' })
  findMyPast(
    @CurrentUser() user: JwtPayload,
    @Query() query: PastBookingsQueryDto,
  ): Promise<PastBookingsPageDto> {
    return this.bookingsService.findMyPast(user.sub, query.offset, query.limit);
  }

  @Get('my/notifications')
  @ApiOperation({ summary: 'Own active "ends soon" notifications (room needed next)' })
  findMyNotifications(@CurrentUser() user: JwtPayload): Promise<MyNotificationDto[]> {
    return this.bookingsService.findMyNotifications(user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel own booking (or this and later occurrences of a series)' })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['one', 'series'],
    description: "'series' cancels this and every later occurrence in the series (default 'one')",
  })
  @ApiResponse({ status: 204, description: 'Booking cancelled' })
  @ApiResponse({ status: 403, description: 'Not the owner of the booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('scope') scope?: string,
  ): Promise<void> {
    await this.bookingsService.remove(user.sub, id, scope === 'series' ? 'series' : 'one');
  }
}
