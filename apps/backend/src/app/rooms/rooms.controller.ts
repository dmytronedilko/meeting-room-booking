import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { BookingDto, RoomDto } from '@office/shared';

import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GetBookingsQueryDto } from './dto/get-bookings-query.dto';
import { RoomsService } from './rooms.service';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all meeting rooms' })
  findAll(): Promise<RoomDto[]> {
    return this.roomsService.findAll();
  }

  @Get(':id/bookings')
  @ApiOperation({ summary: "A room's bookings for 1-7 office-time-zone days from `date`" })
  @ApiResponse({ status: 400, description: 'Invalid date or days' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  findBookings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetBookingsQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookingDto[]> {
    return this.roomsService.findBookings(id, query.date, query.days, user.sub);
  }
}
