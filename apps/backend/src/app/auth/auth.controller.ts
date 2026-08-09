import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthResponseDto, UserDto } from '@office/shared';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayload } from './auth.types';
import { clearAuthCookie, setAuthCookie } from './auth-cookie';
import { AuthService } from './auth.service';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new employee account (sets the session cookie)' })
  @ApiResponse({ status: 201, description: 'Account created, session cookie set' })
  @ApiResponse({ status: 409, description: 'Email already taken' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponseDto> {
    const auth = await this.authService.register(dto);
    setAuthCookie(reply, auth.token);
    return auth;
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password (sets the session cookie)' })
  @ApiResponse({ status: 200, description: 'Session cookie set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponseDto> {
    const auth = await this.authService.login(dto);
    setAuthCookie(reply, auth.token);
    return auth;
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log out (clears the session cookie)' })
  @ApiResponse({ status: 204, description: 'Session cookie cleared' })
  logout(@Res({ passthrough: true }) reply: FastifyReply): void {
    clearAuthCookie(reply);
  }

  @Post('confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an email address using the token from the logged link' })
  @ApiResponse({ status: 200, description: 'Email confirmed' })
  @ApiResponse({ status: 400, description: 'Invalid or already-used token' })
  confirm(@Body() dto: ConfirmEmailDto): Promise<UserDto> {
    return this.authService.confirmEmail(dto.token);
  }

  @Post('resend-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Re-log a confirmation link for the current (unconfirmed) user' })
  @ApiResponse({ status: 204, description: 'Link re-issued (or already confirmed)' })
  resendConfirmation(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.authService.resendConfirmation(user.sub);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile (reflects live email-confirmation state)' })
  @ApiResponse({ status: 200, description: 'The authenticated user' })
  getMe(@CurrentUser() user: JwtPayload): Promise<UserDto> {
    return this.authService.getMe(user.sub);
  }
}
