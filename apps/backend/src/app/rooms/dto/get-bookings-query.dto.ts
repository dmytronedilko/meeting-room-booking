import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { DAYS_PER_WEEK } from '@office/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class GetBookingsQueryDto {
  @ApiProperty({ example: '2026-07-20', description: 'First day of the range (office time zone)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @ApiPropertyOptional({
    example: DAYS_PER_WEEK,
    description: `Number of consecutive days to return, 1-${DAYS_PER_WEEK} (default 1)`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DAYS_PER_WEEK)
  days = 1;
}
