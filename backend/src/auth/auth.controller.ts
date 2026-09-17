import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Query,
  Headers,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleVerifyTokenDto } from './dto/google-auth.dto';
import { GoogleOAuthPayload } from '@shared/types/auth';
import * as crypto from 'crypto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * GET /auth/google
   * Redirects browser to Google's OAuth 2.0 consent screen
   */
  @Get('google')
  async initiateGoogleOAuth(@Req() req: Request, @Res() res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri =
      process.env.GOOGLE_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    if (!clientId) {
      this.logger.warn('Google OAuth requested but GOOGLE_CLIENT_ID is not configured');
      return res.redirect('/?auth=unconfigured&reason=GOOGLE_CLIENT_ID_REQUIRED');
    }

    // Generate cryptographic CSRF state (256-bit entropy)
    const state = crypto.randomBytes(32).toString('hex');
    res.cookie('niva_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/',
    });

    const scope = encodeURIComponent('openid email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

    return res.redirect(authUrl);
  }

  /**
   * GET /auth/google/url
   * Returns Google OAuth 2.0 configuration and authorization URL with secure state cookie
   */
  @Get('google/url')
  getGoogleAuthUrl(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri =
      process.env.GOOGLE_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    if (!clientId) {
      return {
        configured: false,
        message: 'GOOGLE_CLIENT_ID not configured in environment.',
        clientId: null,
        url: null,
      };
    }

    const state = crypto.randomBytes(32).toString('hex');
    res.cookie('niva_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/',
    });

    const scope = encodeURIComponent('openid email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

    return {
      configured: true,
      url,
      clientId,
      redirectUri,
    };
  }

  /**
   * GET /auth/google/callback
   * OAuth 2.0 callback endpoint handling authorization code from Google
   */
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cookieState = req.cookies?.niva_oauth_state;

    if (error) {
      res.clearCookie('niva_oauth_state', { path: '/' });
      this.logger.warn(`Google OAuth callback error received: ${error}`);
      return res.redirect(`/?auth=error&reason=${encodeURIComponent(error)}`);
    }

    // Strict CSRF State Validation
    const stateValidation = this.authService.validateOAuthState(state, cookieState);
    if (!stateValidation.valid) {
      res.clearCookie('niva_oauth_state', { path: '/' });
      this.logger.warn(`OAuth callback state validation failed: ${stateValidation.reason}`);
      return res.redirect(`/?auth=error&reason=${stateValidation.reason}`);
    }

    // Invalidate state cookie immediately to prevent replay attacks
    res.clearCookie('niva_oauth_state', { path: '/' });

    if (!code || typeof code !== 'string') {
      return res.redirect('/?auth=error&reason=MISSING_AUTHORIZATION_CODE');
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const redirectUri =
      process.env.GOOGLE_CALLBACK_URL || `${protocol}://${host}/api/auth/google/callback`;

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    try {
      const session = await this.authService.exchangeAuthorizationCode(code, redirectUri, {
        ipAddress,
        userAgent,
      });

      // Issue HttpOnly session cookie
      res.cookie('niva_session', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Clear state cookie
      res.clearCookie('niva_oauth_state', { path: '/' });

      return res.redirect('/?auth=success');
    } catch (err: any) {
      this.logger.error(`OAuth callback handling failed: ${err.message}`);
      return res.redirect(`/?auth=error&reason=${encodeURIComponent(err.message)}`);
    }
  }

  /**
   * POST /auth/google/verify
   * Verifies Google token / credential and signs in user
   */
  @Post('google/verify')
  @HttpCode(HttpStatus.OK)
  async verifyGoogleToken(
    @Body() body: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    let session;

    // Case 1: ID token / credential from Google Identity Services
    const idToken = body?.idToken || body?.credential;
    if (idToken && typeof idToken === 'string') {
      session = await this.authService.verifyGoogleIdToken(idToken, { ipAddress, userAgent });
    }
    // Case 2: Verified Google OAuth payload
    else if (body?.sub && body?.email) {
      const payload: GoogleOAuthPayload = {
        sub: body.sub,
        email: body.email,
        email_verified: Boolean(body.email_verified),
        name: body.name,
        picture: body.picture,
        given_name: body.given_name,
        family_name: body.family_name,
      };
      session = await this.authService.handleGoogleUser(payload, { ipAddress, userAgent });
    } else {
      throw new BadRequestException('Invalid Google authentication payload');
    }

    // Set HttpOnly session cookie
    res.cookie('niva_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
        user: session.user,
      },
    };
  }

  /**
   * GET /auth/me
   * Returns currently authenticated user's safe profile info
   */
  @Get('me')
  async getCurrentUser(@Req() req: Request) {
    // Extract token from HttpOnly cookie first, then Bearer header
    let token: string | undefined = req.cookies?.niva_session;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '').trim();
      }
    }

    if (!token) {
      throw new UnauthorizedException('No active authenticated session');
    }

    const session = await this.authService.validateSession(token);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Return safe user profile — NO secrets, NO tokens, NO hashes
    return {
      success: true,
      user: session.user,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * POST /auth/logout
   * Invalidates server session and clears HttpOnly session cookie
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let token: string | undefined = req.cookies?.niva_session;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '').trim();
      }
    }

    if (token) {
      const session = await this.authService.validateSession(token);
      await this.authService.logout(token, session?.user?.id);
    }

    res.clearCookie('niva_session', { path: '/' });
    res.clearCookie('niva_oauth_state', { path: '/' });

    return { success: true, message: 'Logged out successfully' };
  }
}
