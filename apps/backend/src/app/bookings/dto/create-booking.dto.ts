import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_REPEAT_WEEKS, MAX_TITLE_LENGTH, type CreateBookingRequest } from '@office/shared';
import { Transform, Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

import { trimString } from '../../common/transforms';

export class CreateBookingDto implements CreateBookingRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomId!: string;

  @ApiProperty({ example: 'Sprint planning', minLength: 1, maxLength: MAX_TITLE_LENGTH })
  // Trim first so whitespace-only titles fail the length check.
  @Transform(trimString)
  @IsString()
  @Length(1, MAX_TITLE_LENGTH)
  title!: string;

  @ApiProperty({ example: '2026-07-20T07:00:00.000Z', description: 'ISO-8601 UTC instant' })
  @IsISO8601()
  startsAt!: string;

  @ApiProperty({ example: '2026-07-20T08:00:00.000Z', description: 'ISO-8601 UTC instant' })
  @IsISO8601()
  endsAt!: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: MAX_REPEAT_WEEKS,
    description: `Weekly occurrences to create, 1-${MAX_REPEAT_WEEKS} (default 1)`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_REPEAT_WEEKS)
  repeatWeeks?: number;
}
