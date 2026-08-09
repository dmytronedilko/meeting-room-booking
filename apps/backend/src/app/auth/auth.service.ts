import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponseDto, UserDto } from '@office/shared';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { isPgError, PG_UNIQUE_VIOLATION } from '../../db/pg-errors';
import { type User, users } from '../../db/schema';
import type { JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.appUrl = config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const emailConfirmToken = randomUUID();
    try {
      const [user] = await this.db
        .insert(users)
        .values({
          name: dto.name.trim(),
          email: dto.email.toLowerCase(),
          passwordHash,
          emailConfirmToken,
        })
        .returning();
      this.logConfirmationLink(user.email, emailConfirmToken);
      return this.buildAuthResponse(user);
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) {
        throw new ConflictException('This email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase()),
    });
    const passwordMatches = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.buildAuthResponse(user);
  }

  /** Confirms the email that owns `token`. Idempotent tokens are single-use. */
  async confirmEmail(token: string): Promise<UserDto> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.emailConfirmToken, token),
    });
    if (!user) {
      throw new BadRequestException('Invalid or already-used confirmation link');
    }
    const [confirmed] = await this.db
      .update(users)
      .set({ emailConfirmedAt: new Date(), emailConfirmToken: null })
      .where(eq(users.id, user.id))
      .returning();
    return this.toUserDto(confirmed);
  }

  /** Re-issues and re-logs a confirmation link for a still-unconfirmed user. */
  async resendConfirmation(userId: string): Promise<void> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.emailConfirmedAt) {
      return; // Already confirmed — nothing to resend.
    }
    const emailConfirmToken = randomUUID();
    await this.db.update(users).set({ emailConfirmToken }).where(eq(users.id, user.id));
    this.logConfirmationLink(user.email, emailConfirmToken);
  }

  /** The current user's profile (used by the frontend to reflect live state). */
  async getMe(userId: string): Promise<UserDto> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toUserDto(user);
  }

  private async buildAuthResponse(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.name };
    const token = await this.jwtService.signAsync(payload);
    return { token, user: this.toUserDto(user) };
  }

  /**
   * Dev-mode "email delivery": no SMTP — the confirmation link is written to the
   * server log for the user to open. Swap this for a real mailer in production.
   */
  private logConfirmationLink(email: string, token: string): void {
    const link = `${this.appUrl}/confirm-email?token=${token}`;
    this.logger.log(`Email confirmation link for ${email}: ${link}`);
  }

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      emailConfirmed: user.emailConfirmedAt !== null,
    };
  }
}
