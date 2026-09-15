import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { GoogleVerifyTokenDto } from './dto/google-auth.dto';
import { GoogleOAuthPayload } from '@shared/types/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Generates Google OAuth 2.0 redirection URL for the client
   */
  @Get('google/url')
  getGoogleAuthUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri =
      process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId) {
      return {
        configured: false,
        message: 'GOOGLE_CLIENT_ID not configured in environment. Interactive simulation active.',
        url: null,
      };
    }

    const scope = encodeURIComponent('openid email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

    return {
      configured: true,
      url,
      clientId,
    };
  }

  /**
   * Verifies Google token / credential and signs in user
   */
  @Post('google/verify')
  @HttpCode(HttpStatus.OK)
  async verifyGoogleToken(
    @Body() body: GoogleVerifyTokenDto | GoogleOAuthPayload,
    @Req() req: Request,
  ) {
    // Determine client metadata
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // If already parsed profile payload (e.g. from Google Identity Services client JWT)
    const payload = body as GoogleOAuthPayload;
    if (payload.sub && payload.email) {
      const session = await this.authService.handleGoogleUser(payload, {
        ipAddress,
        userAgent,
      });
      return { success: true, session };
    }

    throw new UnauthorizedException('Missing valid Google OAuth credential');
  }

  /**
   * Validates the active session
   */
  @Get('me')
  async getCurrentUser(
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No authorization session token provided');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const session = await this.authService.validateSession(token);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return {
      success: true,
      user: session.user,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Log out and invalidate session
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Headers('authorization') authHeader?: string) {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const session = await this.authService.validateSession(token);
      await this.authService.logout(token, session?.user.id);
    }
    return { success: true, message: 'Logged out successfully' };
  }
}
