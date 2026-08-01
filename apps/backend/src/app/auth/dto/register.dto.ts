import { ApiProperty } from '@nestjs/swagger';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, type RegisterRequest } from '@office/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

import { normalizeEmail, trimString } from '../../common/transforms';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'Jane Doe' })
  // Trim first so whitespace-only names fail @IsNotEmpty.
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'jane@office.dev' })
  // Uniqueness is case-insensitive and ignores edge whitespace.
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'password123',
    minLength: MIN_PASSWORD_LENGTH,
    maxLength: MAX_PASSWORD_LENGTH,
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}
