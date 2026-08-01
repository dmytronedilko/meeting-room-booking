import { ApiProperty } from '@nestjs/swagger';
import type { ConfirmEmailRequest } from '@office/shared';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmEmailDto implements ConfirmEmailRequest {
  @ApiProperty({ description: 'Confirmation token from the emailed (logged) link' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
