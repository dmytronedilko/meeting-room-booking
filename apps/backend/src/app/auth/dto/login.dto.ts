import { ApiProperty } from '@nestjs/swagger';
import type { LoginRequest } from '@office/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

import { normalizeEmail } from '../../common/transforms';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'test1@office.dev' })
  // Same normalization as on register, so " Test1@Office.dev " still logs in.
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
