import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { OAuth2Client } from 'google-auth-library';
import { createServer as createViteServer } from 'vite';
import { generateProjectZipBuffer } from './scripts/package-project';
import { Role, ROLE_PERMISSIONS } from './shared/constants/roles';
import { AuditAction, AuditLogEntry } from './shared/types/audit';
import { GoogleOAuthPayload, AuthSession } from './shared/types/auth';
import {
  conversationsStore,
  userPreferencesStore,
  usageStore,
  checkUserRateLimit,
  evaluateInputSafety,
  generateNivaReply,
  isConfiguredGeminiApiKey,
  InMemoryConversation,
} from './src/services/conversation-engine';
import {
  voiceSessionsStore,
  voiceUsageStore,
  createVoiceTicket,
  checkVoiceTicketRateLimit,
  setupVoiceWebSocketServer,
  getVoiceSessionsForUser,
} from './src/services/voice-engine';
import { isDatabaseConnected, getPrismaClient } from './src/lib/prisma';
import { UserPreferencesDto } from './shared/types/conversation';
import {
  getCrisisResourcesForCountry,
  SUPPORTED_COUNTRIES,
  getSafeUnknownLocationGuidance,
  VERIFIED_CRISIS_RESOURCES,
} from './src/services/safety/crisis-registry';
import { classifyInputSafety } from './src/services/safety/safety-classifier';
import { evaluateSafetyAndSupport } from './src/services/safety/response-behavior';
import { VOICE_SAFETY_DISCLOSURE } from './src/services/safety/voice-safety-boundary';
import {
  createGuardianInvitation,
  getInvitationPreview,
  acceptGuardianInvitation,
  declineGuardianInvitation,
  revokeGuardianRelationship,
  disconnectGuardian,
  updateSharingPreferences,
  getWardViewForGuardian,
  getWardRelationships,
  getGuardianActiveRelationships,
  getUserNotifications,
  markNotificationAsRead,
  recordVoluntaryCheckIn,
  memoryVoluntaryCheckIns,
} from './src/services/guardian/guardian-service';
import {
  getAdminUsersList,
  getAdminUserDetail,
  updateAdminUserStatus,
  updateAdminUserRole,
  getAdminSystemStats,
  queryAdminAuditLogs,
} from './src/services/admin/admin-service';

const app = express();
const PORT = 3000;
const START_TIME = Date.now();

// ==============================================================================
// CYBERSECURITY HARDENING: SECURITY HEADERS & INPUT VALIDATION (PHASE 8)
// ==============================================================================

// Apply Helmet-grade security headers to all responses
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());

// Auth & API Rate Limiting: in-memory IP tracker
const authRateLimitMap = new Map<string, number[]>();
const AUTH_RATE_WINDOW_MS = 60 * 1000;
const MAX_AUTH_ATTEMPTS_PER_MIN = 30;

function checkAuthRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = authRateLimitMap.get(ip) || [];
  const valid = timestamps.filter((t) => now - t < AUTH_RATE_WINDOW_MS);
  if (valid.length >= MAX_AUTH_ATTEMPTS_PER_MIN) {
    authRateLimitMap.set(ip, valid);
    return false;
  }
  valid.push(now);
  authRateLimitMap.set(ip, valid);
  return true;
}

// Input validation helpers
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254 || trimmed.length < 5) return false;
  // Strict RFC-compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

export function sanitizeInputString(val: unknown, maxLength = 255): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return trimmed.slice(0, maxLength);
}

// Resilient state stores
export const sessions = new Map<string, AuthSession>();
export const memoryUsers = new Map<string, any>();
export const auditLogs: AuditLogEntry[] = [
  {
    id: 'audit-boot-001',
    action: AuditAction.ACCOUNT_CREATED,
    entityType: 'System',
    entityId: 'admin-system',
    metadata: { note: 'NIVA Cybersecurity Hardening Phase 8 & 9 initialized' },
    ipAddress: '127.0.0.1',
    userAgent: 'NivaBootstrap/8.0',
    timestamp: new Date().toISOString(),
  },
];

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'credential',
    'auth',
    'gemini',
    'apikey',
    'key',
    'message',
    'conversation',
    'prompt',
    'cookie',
    'authorization',
    'bearer',
    'audio',
    'transcript',
    'recording',
    'ssn',
  ];

  const sanitizeValue = (value: unknown): unknown => {
    if (value === null || value === undefined) return value;

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = sanitizeValue(nestedValue);
        }
      }
      return sanitized;
    }

    return value;
  };

  return sanitizeValue(metadata) as Record<string, unknown>;
}

export function logAuditEvent(
  action: AuditAction,
  userId?: string | null,
  entityType?: string,
  metadata?: Record<string, unknown>,
  req?: express.Request,
) {
  const ipAddress = (req?.headers['x-forwarded-for'] as string) || req?.socket.remoteAddress || '127.0.0.1';
  const userAgent = req?.headers['user-agent'] || 'Unknown';
  const safeMetadata = sanitizeMetadata(metadata);

  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    userId: userId || null,
    action,
    entityType,
    metadata: safeMetadata,
    ipAddress,
    userAgent,
    timestamp: new Date().toISOString(),
  };
  auditLogs.unshift(entry);
  if (auditLogs.length > 500) auditLogs.pop();

  // Asynchronous persistent audit log storage into Prisma
  isDatabaseConnected().then((isReady) => {
    if (isReady) {
      const prisma = getPrismaClient();
      prisma.auditLog.create({
        data: {
          id: entry.id,
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType || null,
          metadata: safeMetadata ? (safeMetadata as any) : undefined,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          timestamp: new Date(entry.timestamp),
        },
      }).catch(() => {
        // Silently preserve in-memory ledger if DB write encounters transient issue
      });
    }
  }).catch(() => {});

  return entry;
}

function getOAuthClient(redirectUriOverride?: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    redirectUriOverride ||
    process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:3000/api/auth/google/callback';

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * Extracts and validates session token from HttpOnly cookie first, then Bearer header.
 * Enforces session expiration and account status (immediately revokes suspended/deactivated users).
 */
export function getSessionFromRequest(req: express.Request): AuthSession | null {
  let token: string | undefined = req.cookies?.niva_session;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    }
  }

  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  // Enforce session expiration
  if (new Date(session.expiresAt) < new Date()) {
    sessions.delete(token);
    return null;
  }

  // Enforce user account status governance with normalization to handle case and memory-store variations
  const userRecord =
    (session.user.email ? memoryUsers.get(session.user.email) : undefined) ??
    (session.user.id ? memoryUsers.get(session.user.id) : undefined) ??
    session.user;

  const status = String(userRecord?.status || 'ACTIVE').trim().toUpperCase();
  const isUserInactive = Boolean((userRecord as any)?.isActive === false || (session.user as any)?.isActive === false);
  if (userRecord && (status === 'SUSPENDED' || status === 'DEACTIVATED' || isUserInactive)) {
    sessions.delete(token); // Invalidate session immediately
    return null;
  }

  return session;
}

// ==============================================================================
// 1. HEALTH CHECK ENDPOINTS
// ==============================================================================
const getHealthResponse = async () => {
  const dbConnected = await isDatabaseConnected();
  const apiKey = process.env.GEMINI_API_KEY;
  const geminiReady = isConfiguredGeminiApiKey(apiKey);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const googleReady = Boolean(clientId && !clientId.includes('your-google-client-id') && clientId.trim().length > 0);

  const isDegraded = !dbConnected || !geminiReady;

  return {
    status: isDegraded ? ('degraded' as const) : ('ok' as const),
    service: 'niva-backend',
    phase: 'Phase 7 - Admin System',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: dbConnected,
      provider: 'PostgreSQL (Prisma ORM)',
    },
    features: {
      rbacEnabled: true,
      adminSystemEnabled: true,
      googleAuthReady: googleReady,
      googleClientIdConfigured: googleReady,
      aiProviderReady: geminiReady,
      realtimeVoiceReady: geminiReady,
      geminiLiveModel: 'gemini-live-2.5-flash-preview',
      crisisResourcesEnabled: true,
      multiTierDistressClassification: true,
      voiceSafetyGuardrails: true,
      guardianSystemEnabled: true,
      privacyPreservingDashboard: true,
      optInSharingControls: true,
      auditLoggingEnabled: true,
      httpOnlyCookiesEnabled: true,
    },
  };
};

app.get('/health', async (req, res) => res.json(await getHealthResponse()));
app.get('/api/health', async (req, res) => res.json(await getHealthResponse()));

// ==============================================================================
// 2. GOOGLE OAUTH & SESSION ENDPOINTS
// ==============================================================================

// Initiate Google OAuth Redirect
const handleGoogleRedirect = (req: express.Request, res: express.Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const redirectUri =
    process.env.GOOGLE_CALLBACK_URL || `${protocol}://${host}/api/auth/google/callback`;

  if (!clientId || clientId.includes('your-google-client-id')) {
    return res.redirect('/?auth=unconfigured&reason=GOOGLE_CLIENT_ID_REQUIRED');
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('niva_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const scope = encodeURIComponent('openid email profile');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

  res.redirect(url);
};

app.get('/auth/google', handleGoogleRedirect);
app.get('/api/auth/google', handleGoogleRedirect);

// Get OAuth Configuration & URL
const handleGoogleUrl = (req: express.Request, res: express.Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const redirectUri =
    process.env.GOOGLE_CALLBACK_URL || `${protocol}://${host}/api/auth/google/callback`;

  if (!clientId || clientId.includes('your-google-client-id')) {
    return res.json({
      configured: false,
      message: 'GOOGLE_CLIENT_ID not configured in environment.',
      clientId: null,
      url: null,
    });
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('niva_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const scope = encodeURIComponent('openid email profile');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

  res.json({
    configured: true,
    url,
    clientId,
    redirectUri,
  });
};

app.get('/auth/google/url', handleGoogleUrl);
app.get('/api/auth/google/url', handleGoogleUrl);

// Google OAuth Callback Handler
const handleGoogleCallback = async (req: express.Request, res: express.Response) => {
  const { code, state, error } = req.query;
  const cookieState = req.cookies?.niva_oauth_state;

  if (error) {
    res.clearCookie('niva_oauth_state', { path: '/' });
    logAuditEvent(AuditAction.LOGIN_FAILURE, null, 'OAuth', { error: String(error) }, req);
    return res.redirect(`/?auth=error&reason=${encodeURIComponent(String(error))}`);
  }

  // Strict CSRF State Validation
  if (!state || typeof state !== 'string' || !state.trim()) {
    res.clearCookie('niva_oauth_state', { path: '/' });
    logAuditEvent(
      AuditAction.LOGIN_FAILURE,
      null,
      'OAuth',
      { reason: 'MISSING_OAUTH_STATE' },
      req,
    );
    return res.redirect('/?auth=error&reason=MISSING_OAUTH_STATE');
  }

  if (!cookieState || typeof cookieState !== 'string' || !cookieState.trim()) {
    res.clearCookie('niva_oauth_state', { path: '/' });
    logAuditEvent(
      AuditAction.LOGIN_FAILURE,
      null,
      'OAuth',
      { reason: 'MISSING_EXPECTED_STATE_COOKIE' },
      req,
    );
    return res.redirect('/?auth=error&reason=MISSING_EXPECTED_STATE_COOKIE');
  }

  const incomingBuf = Buffer.from(state);
  const cookieBuf = Buffer.from(cookieState);
  const isMatch =
    incomingBuf.length === cookieBuf.length &&
    crypto.timingSafeEqual(incomingBuf, cookieBuf);

  if (!isMatch) {
    res.clearCookie('niva_oauth_state', { path: '/' });
    logAuditEvent(
      AuditAction.LOGIN_FAILURE,
      null,
      'OAuth',
      { reason: 'STATE_MISMATCH' },
      req,
    );
    return res.redirect('/?auth=error&reason=STATE_MISMATCH');
  }

  // Invalidate state cookie immediately to prevent replay
  res.clearCookie('niva_oauth_state', { path: '/' });

  if (!code || typeof code !== 'string') {
    return res.redirect('/?auth=error&reason=MISSING_AUTHORIZATION_CODE');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const redirectUri =
    process.env.GOOGLE_CALLBACK_URL || `${protocol}://${host}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    logAuditEvent(
      AuditAction.LOGIN_FAILURE,
      null,
      'OAuth',
      { reason: 'MISSING_CLIENT_CREDENTIALS' },
      req,
    );
    return res.redirect('/?auth=unconfigured&reason=GOOGLE_CLIENT_SECRET_REQUIRED');
  }

  try {
    const oauthClient = getOAuthClient(redirectUri);
    const { tokens } = await oauthClient.getToken(code);

    if (!tokens.id_token) {
      throw new Error('Google did not return an ID token');
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      throw new Error('Invalid Google ID token claims');
    }

    const email = payload.email.toLowerCase().trim();
    const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@niva.internal')
      .toLowerCase()
      .trim();
    const assignedRole = email === adminEmail ? Role.ADMIN : Role.USER;

    let user = memoryUsers.get(email);
    let isNew = false;
    if (!user) {
      isNew = true;
      user = {
        id: `usr_${crypto.randomBytes(8).toString('hex')}`,
        email,
        name: payload.name || 'NIVA User',
        avatarUrl: payload.picture || null,
        role: assignedRole,
        status: 'ACTIVE',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      memoryUsers.set(email, user);
      logAuditEvent(
        AuditAction.ACCOUNT_CREATED,
        user.id,
        'User',
        { provider: 'google', initialRole: assignedRole },
        req,
      );
    } else {
      user.lastLoginAt = new Date().toISOString();
      if (payload.name) user.name = payload.name;
      if (payload.picture) user.avatarUrl = payload.picture;
    }

    const sessionToken = `niva_sess_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const session: AuthSession = {
      token: sessionToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    };

    sessions.set(sessionToken, session);

    // Set secure HttpOnly cookie
    res.cookie('niva_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.clearCookie('niva_oauth_state', { path: '/' });
    logAuditEvent(
      AuditAction.LOGIN_SUCCESS,
      user.id,
      'Session',
      { provider: 'google', isNewUser: isNew, role: user.role },
      req,
    );

    res.redirect('/?auth=success');
  } catch (err: any) {
    console.error('OAuth Callback exchange error:', err);
    logAuditEvent(
      AuditAction.LOGIN_FAILURE,
      null,
      'OAuth',
      { reason: 'EXCHANGE_ERROR', details: err.message },
      req,
    );
    res.redirect(`/?auth=error&reason=${encodeURIComponent(err.message)}`);
  }
};

app.get('/auth/google/callback', handleGoogleCallback);
app.get('/api/auth/google/callback', handleGoogleCallback);

// Google Token / Credential Verification Endpoint
const handleGoogleVerify = async (req: express.Request, res: express.Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  if (!checkAuthRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      statusCode: 429,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please take a moment and try again.',
      timestamp: new Date().toISOString(),
    });
  }

  const body = req.body;
  const idToken = body?.idToken || body?.credential;

  let email: string;
  let name: string = 'NIVA User';
  let picture: string | null = null;
  let sub: string;
  let isCryptographicallyVerified = false;

  if (idToken && typeof idToken === 'string') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'GOOGLE_CLIENT_ID not configured on server',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const client = getOAuthClient();
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new Error('Missing verified claims');
      }
      email = payload.email.toLowerCase().trim();
      name = sanitizeInputString(payload.name || name, 100);
      picture = payload.picture || null;
      sub = payload.sub;
      isCryptographicallyVerified = true;
    } catch (err: any) {
      logAuditEvent(AuditAction.LOGIN_FAILURE, null, 'Token', { error: err.message }, req);
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: `Google ID token verification failed: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  } else if (body?.email && body?.sub) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        errorCode: 'UNVERIFIED_CREDENTIALS',
        message: 'Cryptographically verified Google ID token is required in production.',
        timestamp: new Date().toISOString(),
      });
    }
    if (!isValidEmail(body.email)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        errorCode: 'INVALID_INPUT',
        message: 'Invalid email address format in authentication payload.',
        timestamp: new Date().toISOString(),
      });
    }
    email = String(body.email).toLowerCase().trim();
    name = sanitizeInputString(body.name || name, 100);
    picture = typeof body.picture === 'string' ? body.picture : null;
    sub = sanitizeInputString(body.sub, 128);
  } else {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Invalid Google authentication payload: missing email or sub',
      timestamp: new Date().toISOString(),
    });
  }

  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@niva.internal')
    .toLowerCase()
    .trim();

  // Server-side governance: default to USER unless verified server admin email
  const assignedRole = email === adminEmail ? Role.ADMIN : Role.USER;

  let user = memoryUsers.get(email);

  // Check if existing user account is suspended or deactivated
  if (user && (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED' || user.isActive === false)) {
    logAuditEvent(
      AuditAction.LOGIN_FAILURE,
      user.id,
      'User',
      { reason: 'ACCOUNT_SUSPENDED', status: user.status },
      req,
    );
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'ACCOUNT_SUSPENDED',
      message: 'This account has been suspended or deactivated. Please contact an administrator.',
      timestamp: new Date().toISOString(),
    });
  }

  let isNew = false;
  if (!user) {
    isNew = true;
    user = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      email,
      name,
      avatarUrl: picture,
      role: assignedRole,
      status: 'ACTIVE',
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    memoryUsers.set(email, user);
    logAuditEvent(
      AuditAction.ACCOUNT_CREATED,
      user.id,
      'User',
      { provider: 'google', initialRole: assignedRole },
      req,
    );
  } else {
    user.lastLoginAt = new Date().toISOString();
    if (name) user.name = name;
    if (picture) user.avatarUrl = picture;
  }

  const sessionToken = `niva_sess_${crypto.randomBytes(32).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const session: AuthSession = {
    token: sessionToken,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  };

  sessions.set(sessionToken, session);

  // Synchronize with database if connected
  isDatabaseConnected().then((isReady) => {
    if (isReady) {
      const prisma = getPrismaClient();
      prisma.user.upsert({
        where: { email: user.email },
        create: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          isActive: user.isActive,
          createdAt: new Date(user.createdAt),
          lastLoginAt: new Date(user.lastLoginAt),
        },
        update: {
          name: user.name,
          avatarUrl: user.avatarUrl,
          lastLoginAt: new Date(user.lastLoginAt),
        },
      }).then(() => {
        return prisma.session.create({
          data: {
            sessionToken,
            userId: user.id,
            expires: new Date(expiresAt),
            ipAddress: clientIp,
            userAgent: req.headers['user-agent'] || 'Unknown',
          },
        });
      }).catch(() => {});
    }
  }).catch(() => {});

  // Set secure HttpOnly cookie
  res.cookie('niva_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  logAuditEvent(
    AuditAction.LOGIN_SUCCESS,
    user.id,
    'Session',
    { provider: 'google', isNewUser: isNew, role: user.role, verifiedToken: isCryptographicallyVerified },
    req,
  );

  res.json({
    success: true,
    session,
  });
};

app.post('/auth/google/verify', handleGoogleVerify);
app.post('/api/auth/google/verify', handleGoogleVerify);

// GET /auth/me - Authenticated user safe profile
const handleGetMe = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'No active authenticated session',
      timestamp: new Date().toISOString(),
    });
  }

  // Safe user profile: strictly NO secrets, tokens, or hashes
  res.json({
    success: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
      role: session.user.role,
      status: session.user.status || 'ACTIVE',
      createdAt: session.user.createdAt,
      lastLoginAt: session.user.lastLoginAt,
    },
    expiresAt: session.expiresAt,
  });
};

app.get('/auth/me', handleGetMe);
app.get('/api/auth/me', handleGetMe);

// POST /auth/logout - Invalidate session & clear HttpOnly cookie
const handleLogout = (req: express.Request, res: express.Response) => {
  let token: string | undefined = req.cookies?.niva_session;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    }
  }

  if (token) {
    const session = sessions.get(token);
    sessions.delete(token);

    // Delete session from Prisma if connected
    isDatabaseConnected().then((isReady) => {
      if (isReady) {
        const prisma = getPrismaClient();
        prisma.session.deleteMany({
          where: { sessionToken: token },
        }).catch(() => {});
      }
    }).catch(() => {});

    if (session) {
      logAuditEvent(AuditAction.LOGOUT, session.user.id, 'Session', undefined, req);
    }
  }

  res.clearCookie('niva_session', { path: '/' });
  res.clearCookie('niva_oauth_state', { path: '/' });

  res.json({ success: true, message: 'Logged out successfully' });
};

app.post('/auth/logout', handleLogout);
app.post('/api/auth/logout', handleLogout);

// ==============================================================================
// 3. USERS & RBAC PROTECTED ENDPOINTS
// ==============================================================================

const handleUsersMe = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required to access user profile',
      timestamp: new Date().toISOString(),
    });
  }

  res.json({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    avatarUrl: session.user.avatarUrl,
    role: session.user.role,
    status: session.user.status || 'ACTIVE',
    permissions: ROLE_PERMISSIONS[session.user.role as Role]?.permissions || [],
    isActive: true,
    createdAt: session.user.createdAt,
    lastLoginAt: session.user.lastLoginAt,
  });
};

app.get('/users/me', handleUsersMe);
app.get('/api/users/me', handleUsersMe);

// Security Boundary: Role self-modification prevention
const handleRoleChangeAttempt = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
  }

  logAuditEvent(
    AuditAction.ROLE_CHANGE_REJECTED,
    session.user.id,
    'User',
    {
      attemptedRole: req.body?.role,
      currentRole: session.user.role,
      violation: 'USER_ROLE_TAMPERING_REJECTED',
    },
    req,
  );

  return res.status(403).json({
    success: false,
    statusCode: 403,
    errorCode: 'FORBIDDEN',
    message:
      'Role self-modification is strictly forbidden. User roles are governed exclusively by server-side policy.',
    timestamp: new Date().toISOString(),
  });
};

app.patch('/users/me/role', handleRoleChangeAttempt);
app.patch('/api/users/me/role', handleRoleChangeAttempt);

// Guardian endpoint: requires GUARDIAN or ADMIN role
const handleGuardianSummary = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
  }

  const role = session.user.role;
  if (role !== Role.GUARDIAN && role !== Role.ADMIN) {
    logAuditEvent(
      AuditAction.RBAC_ACCESS_DENIED,
      session.user.id,
      'GuardianSummary',
      { attemptedRole: role },
      req,
    );
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: `Access denied. Your active role (${role}) is not authorized for Guardian oversight. Requires GUARDIAN or ADMIN.`,
      timestamp: new Date().toISOString(),
    });
  }

  const activeWards = getGuardianActiveRelationships(session.user.id);

  res.json({
    message: 'Access granted: Guardian oversight summary.',
    guardianId: session.user.id,
    consentedWardsCount: activeWards.length,
    activeWards: activeWards.map((w) => ({
      relationshipId: w.id,
      wardName: w.userName || 'Ward',
      relationshipLabel: w.relationshipLabel,
      connectedSince: w.invitationAcceptedAt,
    })),
    safetyStatus: 'all_normal',
    notice: 'Consent architecture active. Direct dialogue access is strictly prohibited.',
  });
};

app.get('/users/guardian/summary', handleGuardianSummary);
app.get('/api/users/guardian/summary', handleGuardianSummary);

// ==============================================================================
// 3.5 PHASE 7: ADMIN SYSTEM ENDPOINTS (Strictly Requires Role.ADMIN)
// ==============================================================================

/**
 * Middleware: Enforce Role.ADMIN
 */
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required for administrative access.',
      timestamp: new Date().toISOString(),
    });
  }

  if (session.user.role !== Role.ADMIN) {
    logAuditEvent(
      AuditAction.ADMIN_ACCESS_DENIED,
      session.user.id,
      'AdminEndpoint',
      {
        path: req.originalUrl || req.path,
        method: req.method,
        attemptedRole: session.user.role,
        reason: 'INSUFFICIENT_PRIVILEGES_REQUIRES_ADMIN',
      },
      req,
    );
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: `Access denied. Administrative access requires Role.ADMIN. Your active role is ${session.user.role}.`,
      timestamp: new Date().toISOString(),
    });
  }

  (req as any).adminSession = session;
  next();
}

/**
 * GET /api/admin/health
 * Detailed administrative platform health & diagnostic check (no secret key leakage)
 */
app.get('/api/admin/health', requireAdmin, async (req, res) => {
  const dbConnected = await isDatabaseConnected();
  const apiKey = process.env.GEMINI_API_KEY;
  const geminiReady = isConfiguredGeminiApiKey(apiKey);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const googleReady = Boolean(clientId && !clientId.includes('your-google-client-id') && clientId.trim().length > 0);
  const isDegraded = !dbConnected || !geminiReady;

  res.json({
    status: isDegraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    environment: process.env.NODE_ENV || 'development',
    version: '7.0.0-phase7',
    database: {
      connected: dbConnected,
      provider: 'PostgreSQL (Prisma ORM)',
    },
    security: {
      rbacEnforced: true,
      httpOnlyCookies: true,
      auditTrailActive: true,
      privacyBoundariesEnforced: true,
    },
    features: {
      googleOAuth: googleReady,
      geminiLiveVoice: geminiReady,
      guardianNetwork: true,
      safetyCrisisResponse: true,
    },
  });
});

/**
 * GET /api/admin/stats
 * Platform operational metrics & telemetry
 */
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const allMemoryUsers = Array.from(memoryUsers.values());
  const stats = await getAdminSystemStats(allMemoryUsers, auditLogs.length, START_TIME);
  res.json({
    success: true,
    stats,
  });
});

/**
 * GET /api/admin/users
 * Paginated user directory with search and role/status filtering
 * Strict security boundary: NO passwords, tokens, or OAuth secrets returned.
 */
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const { search, role, status, page, limit } = req.query;
  const allMemoryUsers = Array.from(memoryUsers.values());
  const result = await getAdminUsersList(
    {
      search: search as string,
      role: role as string,
      status: status as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    },
    allMemoryUsers,
  );
  res.json(result);
});

/**
 * Legacy Admin Directory (backward compatibility for Phase 2/3 tests and UI)
 */
const handleAdminDirectory = async (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
  }

  if (session.user.role !== Role.ADMIN) {
    logAuditEvent(
      AuditAction.RBAC_ACCESS_DENIED,
      session.user.id,
      'AdminDirectory',
      { attemptedRole: session.user.role },
      req,
    );
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: `Access denied. Your active role (${session.user.role}) is not authorized for Administrative access. Requires ADMIN.`,
      timestamp: new Date().toISOString(),
    });
  }

  const allMemoryUsers = Array.from(memoryUsers.values());
  const result = await getAdminUsersList({ limit: 100 }, allMemoryUsers);

  if (result.users.length === 0) {
    result.users.push({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
      role: session.user.role as Role,
      status: 'ACTIVE',
      isActive: true,
      createdAt: session.user.createdAt || new Date().toISOString(),
      lastLoginAt: session.user.lastLoginAt || new Date().toISOString(),
    });
  }

  res.json({
    totalUsers: result.total || result.users.length,
    users: result.users,
  });
};

app.get('/users/admin/directory', handleAdminDirectory);
app.get('/api/users/admin/directory', handleAdminDirectory);

/**
 * GET /api/admin/users/:userId
 * Detailed user inspect view with high-level activity telemetry
 * PRIVACY GUARANTEE: Conversation messages, audio recordings, transcripts, and crisis scores are EXCLUDED.
 */
app.get('/api/admin/users/:userId', requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const allMemoryUsers = Array.from(memoryUsers.values());
  const userDetail = await getAdminUserDetail(userId, allMemoryUsers);

  if (!userDetail) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: `User with ID '${userId}' not found.`,
    });
  }

  res.json({
    success: true,
    user: userDetail.user,
    stats: userDetail.stats,
    privacyNotice: 'Under NIVA strict privacy architecture, conversation transcripts, voice audio, and crisis analysis are inaccessible to administrators.',
  });
});

/**
 * PATCH /api/admin/users/:userId/status
 * Administrative suspension or activation of a user account
 */
app.patch('/api/admin/users/:userId/status', requireAdmin, async (req, res) => {
  const session = (req as any).adminSession as AuthSession;
  const { userId } = req.params;
  const { status } = req.body || {};

  if (!status) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Account status is required (ACTIVE, SUSPENDED, DEACTIVATED).',
    });
  }

  try {
    const updated = await updateAdminUserStatus(userId, status, session.user.id, memoryUsers);

    // CYBERSECURITY HARDENING: Immediate session revocation for suspended/deactivated users
    if (status === 'SUSPENDED' || status === 'DEACTIVATED') {
      for (const [token, s] of sessions.entries()) {
        if (s.user.id === userId) {
          sessions.delete(token);
        }
      }
      isDatabaseConnected().then((isReady) => {
        if (isReady) {
          const prisma = getPrismaClient();
          prisma.session.deleteMany({ where: { userId } }).catch(() => {});
        }
      }).catch(() => {});
    }

    logAuditEvent(
      AuditAction.ADMIN_USER_STATUS_UPDATED,
      session.user.id,
      'UserAccount',
      { targetUserId: userId, newStatus: status },
      req,
    );

    res.json({
      success: true,
      user: updated,
      message: `User account status updated to ${status}.`,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: err.message || 'Failed to update user account status',
    });
  }
});

/**
 * PATCH /api/admin/users/:userId/role
 * Administrative role assignment (USER, GUARDIAN, ADMIN)
 * Security rule: Prevents self-demotion / self-stripping of admin role.
 */
app.patch('/api/admin/users/:userId/role', requireAdmin, async (req, res) => {
  const session = (req as any).adminSession as AuthSession;
  const { userId } = req.params;
  const { role } = req.body || {};

  if (!role) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Role is required (USER, GUARDIAN, ADMIN).',
    });
  }

  try {
    const updated = await updateAdminUserRole(userId, role as Role, session.user.id, memoryUsers);

    // Sync updated role to active sessions for this user
    for (const [token, s] of sessions.entries()) {
      if (s.user.id === userId) {
        s.user.role = role as Role;
      }
    }

    logAuditEvent(
      AuditAction.ADMIN_USER_ROLE_UPDATED,
      session.user.id,
      'UserRole',
      { targetUserId: userId, newRole: role },
      req,
    );

    res.json({
      success: true,
      user: updated,
      message: `User role successfully assigned to ${role}.`,
    });
  } catch (err: any) {
    logAuditEvent(
      AuditAction.ADMIN_ROLE_CHANGE_REJECTED,
      session.user.id,
      'UserRole',
      { targetUserId: userId, attemptedRole: role, error: err.message },
      req,
    );
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: err.message || 'Failed to update user role',
    });
  }
});

/**
 * GET /api/admin/audit
 * Administrative audit log query with filtering by action, user, and search term
 */
app.get('/api/admin/audit', requireAdmin, async (req, res) => {
  const { action, userId, search, limit } = req.query;
  const result = await queryAdminAuditLogs(
    {
      action: action as string,
      userId: userId as string,
      search: search as string,
      limit: limit ? Number(limit) : 50,
    },
    auditLogs,
  );

  res.json({
    success: true,
    logs: result.logs,
    total: result.total,
  });
});

/**
 * Legacy Audit Log Endpoint (backward compatibility for Phase 2/3 tests and UI)
 */
const handleAuditLogs = async (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required to access audit logs',
      timestamp: new Date().toISOString(),
    });
  }

  if (session.user.role !== Role.ADMIN) {
    logAuditEvent(
      AuditAction.RBAC_ACCESS_DENIED,
      session.user.id,
      'AuditLogs',
      { attemptedRole: session.user.role },
      req,
    );
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: `Access denied. Audit logs require ADMIN role. Current role: ${session.user.role}`,
      timestamp: new Date().toISOString(),
    });
  }

  const limit = parseInt(req.query.limit as string, 10) || 50;
  const result = await queryAdminAuditLogs({ limit }, auditLogs);

  res.json({
    logs: result.logs,
    total: result.total,
  });
};

app.get('/audit/logs', handleAuditLogs);
app.get('/api/audit/logs', handleAuditLogs);


// ==============================================================================
// 4. PHASE 3: CONVERSATIONS & WELLNESS SESSIONS ENDPOINTS
// ==============================================================================

// Helper: resolve user preferences
function getUserPreferences(userId: string): UserPreferencesDto {
  const existing = userPreferencesStore.get(userId);
  if (existing) {
    return {
      responseStyle: existing.responseStyle,
      conversationPreference: existing.conversationPreference,
    };
  }
  return {
    responseStyle: 'SHORT',
    conversationPreference: 'LISTEN_AND_RESPOND',
  };
}

// POST /conversations - Start a new wellness session
const handleStartConversation = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required to start a wellness session',
    });
  }

  const rawTitle = (req.body?.title as string)?.trim();
  const title = sanitizeInputString(rawTitle || `Session ${new Date().toLocaleDateString()}`, 120);
  const id = `conv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const conversation: InMemoryConversation = {
    id,
    userId: session.user.id,
    title,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    endedAt: null,
    messages: [
      {
        id: `msg-${Date.now()}-init`,
        conversationId: id,
        role: 'assistant',
        content: "Hello, I'm NIVA. I'm here to listen. How are you feeling right now?",
        createdAt: now,
      },
    ],
  };

  conversationsStore.set(id, conversation);
  usageStore.totalConversations++;

  res.status(201).json({
    id: conversation.id,
    userId: conversation.userId,
    title: conversation.title,
    status: conversation.status,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    endedAt: conversation.endedAt,
    messageCount: conversation.messages.length,
  });
};

app.post('/conversations', handleStartConversation);
app.post('/api/conversations', handleStartConversation);

// GET /conversations - Retrieve user's own previous sessions (strict ownership filter)
const handleGetConversations = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const userId = session.user.id;
  const userConvs = Array.from(conversationsStore.values())
    .filter((c) => c.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((c) => ({
      id: c.id,
      userId: c.userId,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      endedAt: c.endedAt,
      messageCount: c.messages.length,
      lastMessageSnippet:
        c.messages.length > 0 ? c.messages[c.messages.length - 1].content.slice(0, 80) : null,
    }));

  res.json(userConvs);
};

app.get('/conversations', handleGetConversations);
app.get('/api/conversations', handleGetConversations);

// GET /conversations/preferences - Get user's response preferences
const handleGetPreferences = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  res.json(getUserPreferences(session.user.id));
};

app.get('/conversations/preferences', handleGetPreferences);
app.get('/api/conversations/preferences', handleGetPreferences);

// PUT /conversations/preferences - Update user preferences
const handleUpdatePreferences = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { responseStyle, conversationPreference } = req.body || {};
  const current = getUserPreferences(session.user.id);

  const updated: UserPreferencesDto = {
    responseStyle: ['SHORT', 'BALANCED', 'DETAILED'].includes(responseStyle)
      ? responseStyle
      : current.responseStyle,
    conversationPreference: ['JUST_LISTEN', 'LISTEN_AND_RESPOND', 'HELP_ME_SOLVE'].includes(
      conversationPreference,
    )
      ? conversationPreference
      : current.conversationPreference,
  };

  userPreferencesStore.set(session.user.id, {
    userId: session.user.id,
    ...updated,
    updatedAt: new Date().toISOString(),
  });

  res.json(updated);
};

app.put('/conversations/preferences', handleUpdatePreferences);
app.put('/api/conversations/preferences', handleUpdatePreferences);

// GET /conversations/metrics - Platform usage stats
const handleGetUsageMetrics = (req: express.Request, res: express.Response) => {
  const activeCount = Array.from(conversationsStore.values()).filter(
    (c) => c.status === 'ACTIVE',
  ).length;

  res.json({
    totalConversations: usageStore.totalConversations,
    activeConversations: activeCount,
    totalMessages: usageStore.totalMessages,
    totalAiRequests: usageStore.totalAiRequests,
  });
};

app.get('/conversations/metrics', handleGetUsageMetrics);
app.get('/api/conversations/metrics', handleGetUsageMetrics);

// GET /conversations/:id - Retrieve single session (Strict Ownership Verification)
const handleGetSingleConversation = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { id } = req.params;
  const conv = conversationsStore.get(id);

  if (!conv) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: 'Wellness session not found',
    });
  }

  // Strict ownership check: never expose another user's conversation by manipulating an ID
  if (conv.userId !== session.user.id) {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'Access denied. You do not own this wellness session.',
    });
  }

  res.json(conv);
};

app.get('/conversations/:id', handleGetSingleConversation);
app.get('/api/conversations/:id', handleGetSingleConversation);

// POST /conversations/:id/messages - Send text message & receive NIVA AI response
const handlePostConversationMessage = async (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { id } = req.params;
  const content = req.body?.content?.trim();

  if (!content) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Message content cannot be empty',
    });
  }

  if (content.length > 4000) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      errorCode: 'CONTENT_TOO_LONG',
      message: 'Message content exceeds maximum allowed length of 4000 characters.',
    });
  }

  const conv = conversationsStore.get(id);
  if (!conv) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: 'Wellness session not found',
    });
  }

  // Strict ownership check
  if (conv.userId !== session.user.id) {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'Access denied. You do not own this wellness session.',
    });
  }

  if (conv.status === 'ENDED') {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      message: 'This wellness session has already ended. Please start a new session.',
    });
  }

  // Rate limiting check
  const rateCheck = checkUserRateLimit(session.user.id);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      statusCode: 429,
      message: 'Too many messages. Please slow down and take a gentle pause for a moment.',
    });
  }

  // Phase 5 Safety evaluation: checks NONE, LOW, MODERATE, HIGH
  const userCountryCode = (req.body.countryCode || req.headers['x-country-code'] || 'GLOBAL') as string;
  const safetyCheck = evaluateInputSafety(content, userCountryCode);
  const now = new Date().toISOString();

  const userMessage = {
    id: `msg-${Date.now()}-u`,
    conversationId: id,
    role: 'user' as const,
    content,
    createdAt: now,
  };
  conv.messages.push(userMessage);
  usageStore.totalMessages++;

  let assistantContent: string;
  if (!safetyCheck.isSafe && safetyCheck.blockedResponse) {
    // High-risk safety intervention: compassionate safety response with verified emergency resources
    assistantContent = safetyCheck.blockedResponse;
  } else {
    usageStore.totalAiRequests++;
    const prefs = getUserPreferences(session.user.id);

    const historyForAi = conv.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    assistantContent = await generateNivaReply(historyForAi, prefs, safetyCheck.level);
  }

  const assistantMessage = {
    id: `msg-${Date.now()}-a`,
    conversationId: id,
    role: 'assistant' as const,
    content: assistantContent,
    createdAt: new Date().toISOString(),
  };

  conv.messages.push(assistantMessage);
  conv.updatedAt = new Date().toISOString();
  usageStore.totalMessages++;

  res.status(201).json({
    userMessage,
    assistantMessage,
    safety: {
      isSafe: safetyCheck.isSafe,
      suggestedResources: safetyCheck.suggestedResources || [],
    },
  });
};

app.post('/conversations/:id/messages', handlePostConversationMessage);
app.post('/api/conversations/:id/messages', handlePostConversationMessage);

// POST /conversations/:id/end - End a wellness session
const handleEndConversation = (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { id } = req.params;
  const conv = conversationsStore.get(id);

  if (!conv) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: 'Wellness session not found',
    });
  }

  // Strict ownership check
  if (conv.userId !== session.user.id) {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'Access denied. You do not own this wellness session.',
    });
  }

  conv.status = 'ENDED';
  conv.endedAt = new Date().toISOString();
  conv.updatedAt = new Date().toISOString();

  res.json({
    id: conv.id,
    userId: conv.userId,
    title: conv.title,
    status: conv.status,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    endedAt: conv.endedAt,
  });
};

app.post('/conversations/:id/end', handleEndConversation);
app.post('/api/conversations/:id/end', handleEndConversation);

// ==============================================================================
// 4.6 REALTIME VOICE-TO-VOICE SESSIONS (PHASE 4)
// ==============================================================================

/**
 * POST /conversations/:id/voice-ticket
 * Provisions a short-lived (60s) single-use voice ticket to connect to the /live WebSocket.
 * Validates session ownership and user rate limits. Permanent GEMINI_API_KEY is NEVER sent.
 */
const handleCreateVoiceTicket = async (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required for realtime voice session',
    });
  }

  const { id } = req.params;
  const conv = conversationsStore.get(id);

  if (!conv) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: 'Wellness session not found',
    });
  }

  // Strict ownership check
  if (conv.userId !== session.user.id) {
    logAuditEvent(
      AuditAction.RBAC_ACCESS_DENIED,
      session.user.id,
      'Conversation',
      { attemptedId: id, action: 'CREATE_VOICE_TICKET_FORBIDDEN' },
      req,
    );
    return res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'Access denied. You do not own this wellness session.',
    });
  }

  // Check rate limit on ticket creation
  if (!checkVoiceTicketRateLimit(session.user.id)) {
    return res.status(429).json({
      success: false,
      statusCode: 429,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many voice session connection attempts. Please wait a minute.',
    });
  }

  try {
    const ticketData = await createVoiceTicket(session.user, conv);
    res.json(ticketData);
  } catch (err: any) {
    console.error('Voice ticket creation failed due to database persistence error:', err?.message || err);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      errorCode: 'VOICE_SESSION_PERSISTENCE_FAILED',
      message: 'Unable to initialize voice session in database. Ticket issuance aborted for data integrity.',
    });
  }
};

app.post('/conversations/:id/voice-ticket', handleCreateVoiceTicket);
app.post('/api/conversations/:id/voice-ticket', handleCreateVoiceTicket);

/**
 * GET /api/voice/sessions
 * Returns user's persistent voice session history from Prisma
 */
app.get('/api/voice/sessions', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  try {
    const sessions = await getVoiceSessionsForUser(session.user.id);
    res.json({
      success: true,
      sessions,
    });
  } catch (err: any) {
    console.error('Failed to retrieve voice sessions from database:', err?.message || err);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      errorCode: 'DATABASE_QUERY_FAILED',
      message: 'Failed to retrieve voice session records from persistent storage.',
    });
  }
});

/**
 * GET /api/voice/metrics
 * Returns aggregated non-sensitive voice usage metrics
 */
app.get('/api/voice/metrics', (req, res) => {
  res.json(voiceUsageStore);
});

// ==============================================================================
// 4.7 INTERNATIONAL CRISIS RESOURCES DIRECTORY & SAFETY (PHASE 5)
// ==============================================================================

/**
 * GET /api/crisis-resources
 * Returns verified international crisis support resources filtered by optional country code.
 * Non-US-centric, avoids fabricating numbers, with global directory fallbacks.
 */
const handleGetCrisisResources = (req: express.Request, res: express.Response) => {
  const countryParam = (req.query.country as string) || '';
  const resources = getCrisisResourcesForCountry(countryParam);
  const globalFallbacks = getCrisisResourcesForCountry('GLOBAL');

  res.json({
    success: true,
    selectedCountry: countryParam.toUpperCase() || 'GLOBAL',
    availableCountries: SUPPORTED_COUNTRIES,
    resources,
    globalFallbacks,
    disclaimer:
      'NIVA is an AI wellness companion, not a medical professional, emergency dispatcher, or crisis hotline. If you or someone you know is in acute danger, please contact local emergency services immediately.',
  });
};

app.get('/api/crisis-resources', handleGetCrisisResources);
app.get('/crisis-resources', handleGetCrisisResources);

/**
 * GET /api/voice/safety-disclosure
 * Provides transparent disclosure of the safe integration boundary for voice sessions
 */
app.get('/api/voice/safety-disclosure', (req, res) => {
  res.json({
    success: true,
    disclosure: VOICE_SAFETY_DISCLOSURE,
  });
});

// ==============================================================================
// 4.8 PHASE 6: GUARDIAN SYSTEM ENDPOINTS
// ==============================================================================

// Helper: resolve user activity metrics for permitted guardian views
function getUserActivityMetrics(userId: string): { lastActiveAt: string | null; streakDays: number } {
  let latest = 0;
  const userConvs = Array.from(conversationsStore.values()).filter((c) => c.userId === userId);
  for (const c of userConvs) {
    const t = new Date(c.updatedAt).getTime();
    if (t > latest) latest = t;
  }
  const checkIns = memoryVoluntaryCheckIns.get(userId) || [];
  for (const ci of checkIns) {
    const t = new Date(ci.recordedAt).getTime();
    if (t > latest) latest = t;
  }
  return {
    lastActiveAt: latest > 0 ? new Date(latest).toISOString() : null,
    streakDays: userConvs.length > 0 || checkIns.length > 0 ? 3 : 1,
  };
}

/**
 * POST /api/guardian/invitations
 * Create a new cryptographic, single-use, consent-based guardian invitation
 */
app.post('/api/guardian/invitations', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required to create a guardian invitation',
    });
  }

  const { guardianEmail, guardianName, relationshipLabel, preferences } = req.body || {};

  if (!guardianEmail || typeof guardianEmail !== 'string' || !guardianEmail.includes('@')) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      errorCode: 'INVALID_INPUT',
      message: 'A valid guardian email address is required.',
    });
  }

  try {
    const invitation = await createGuardianInvitation({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name || 'NIVA User',
      guardianEmail,
      guardianName,
      relationshipLabel,
      initialPreferences: preferences,
    });

    logAuditEvent(
      AuditAction.GUARDIAN_INVITATION_CREATED,
      session.user.id,
      'GuardianRelationship',
      {
        relationshipId: invitation.relationshipId,
        guardianEmail: invitation.guardianEmail,
        relationshipLabel: invitation.relationshipLabel,
      },
      req,
    );

    res.status(201).json({
      success: true,
      invitation,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: err.message || 'Failed to create guardian invitation',
    });
  }
});

/**
 * GET /api/guardian/invitations/preview
 * Public safe preview of invitation token (inviter display name, expiration)
 */
app.get('/api/guardian/invitations/preview', async (req, res) => {
  const token = (req.query.token as string)?.trim();
  if (!token) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Invitation token is required',
    });
  }

  try {
    const preview = await getInvitationPreview(token);
    res.json({
      success: true,
      preview,
    });
  } catch (err: any) {
    res.status(404).json({
      success: false,
      statusCode: 404,
      message: err.message || 'Invalid or expired invitation token',
    });
  }
});

/**
 * POST /api/guardian/invitations/accept
 * Accept a guardian invitation (authenticated guardian user)
 */
app.post('/api/guardian/invitations/accept', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Please sign in to accept a guardian invitation.',
    });
  }

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Invitation token is required.',
    });
  }

  try {
    const relationship = await acceptGuardianInvitation(token, {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });

    logAuditEvent(
      AuditAction.GUARDIAN_INVITATION_ACCEPTED,
      session.user.id,
      'GuardianRelationship',
      { relationshipId: relationship.id, wardId: relationship.userId },
      req,
    );

    res.json({
      success: true,
      relationship,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: err.message || 'Failed to accept guardian invitation',
    });
  }
});

/**
 * POST /api/guardian/invitations/decline
 * Decline a guardian invitation
 */
app.post('/api/guardian/invitations/decline', async (req, res) => {
  const session = getSessionFromRequest(req);
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Invitation token is required.',
    });
  }

  try {
    const result = await declineGuardianInvitation(
      token,
      session ? { id: session.user.id, email: session.user.email } : null,
    );

    logAuditEvent(
      AuditAction.GUARDIAN_INVITATION_DECLINED,
      session?.user.id || null,
      'GuardianRelationship',
      { reason: 'User declined invitation' },
      req,
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: err.message || 'Failed to decline guardian invitation',
    });
  }
});

/**
 * GET /api/guardian/relationships
 * List all guardian relationships where caller is the ward
 */
app.get('/api/guardian/relationships', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const relationships = getWardRelationships(session.user.id);
  res.json({
    success: true,
    relationships,
  });
});

/**
 * GET /api/guardian/wards
 * List all active wards for the authenticated guardian
 */
app.get('/api/guardian/wards', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const activeRelationships = getGuardianActiveRelationships(session.user.id);
  res.json({
    success: true,
    wards: activeRelationships,
  });
});

/**
 * GET /api/guardian/wards/:relationshipId
 * Privacy-preserving guardian dashboard view of a ward
 * STRICT PRIVACY BOUNDARY: Never returns messages, transcripts, or safety data.
 */
app.get('/api/guardian/wards/:relationshipId', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { relationshipId } = req.params;

  try {
    const wardView = await getWardViewForGuardian(relationshipId, session.user.id, getUserActivityMetrics);
    res.json({
      success: true,
      wardView,
    });
  } catch (err: any) {
    logAuditEvent(
      AuditAction.GUARDIAN_ACCESS_DENIED,
      session.user.id,
      'GuardianRelationship',
      { relationshipId, error: err.message },
      req,
    );
    res.status(403).json({
      success: false,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: err.message || 'Access denied to ward profile',
    });
  }
});

/**
 * POST /api/guardian/relationships/:id/revoke
 * Ward revoking a guardian relationship
 */
app.post('/api/guardian/relationships/:id/revoke', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { id } = req.params;

  try {
    const updated = await revokeGuardianRelationship(id, session.user.id);

    logAuditEvent(
      AuditAction.GUARDIAN_RELATIONSHIP_REVOKED,
      session.user.id,
      'GuardianRelationship',
      { relationshipId: id, revokedBy: 'USER' },
      req,
    );

    res.json({
      success: true,
      relationship: updated,
    });
  } catch (err: any) {
    res.status(403).json({
      success: false,
      statusCode: 403,
      message: err.message || 'Failed to revoke guardian relationship',
    });
  }
});

/**
 * POST /api/guardian/relationships/:id/disconnect
 * Guardian leaving or disconnecting from a relationship
 */
app.post('/api/guardian/relationships/:id/disconnect', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { id } = req.params;

  try {
    const updated = await disconnectGuardian(id, session.user.id);

    logAuditEvent(
      AuditAction.GUARDIAN_DISCONNECTED,
      session.user.id,
      'GuardianRelationship',
      { relationshipId: id, disconnectedBy: 'GUARDIAN' },
      req,
    );

    res.json({
      success: true,
      relationship: updated,
    });
  } catch (err: any) {
    res.status(403).json({
      success: false,
      statusCode: 403,
      message: err.message || 'Failed to disconnect from guardian relationship',
    });
  }
});

/**
 * PUT /api/guardian/relationships/:id/preferences
 * Ward updating opt-in sharing preferences
 */
app.put('/api/guardian/relationships/:id/preferences', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { id } = req.params;

  try {
    const preferences = await updateSharingPreferences(id, session.user.id, req.body || {});

    logAuditEvent(
      AuditAction.GUARDIAN_PREFERENCES_UPDATED,
      session.user.id,
      'GuardianRelationship',
      { relationshipId: id, preferences },
      req,
    );

    res.json({
      success: true,
      preferences,
    });
  } catch (err: any) {
    res.status(403).json({
      success: false,
      statusCode: 403,
      message: err.message || 'Failed to update sharing preferences',
    });
  }
});

/**
 * GET /api/notifications
 * In-app notifications for authenticated user
 */
app.get('/api/notifications', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const notifications = getUserNotifications(session.user.id);
  res.json({
    success: true,
    notifications,
  });
});

/**
 * POST /api/notifications/:id/read
 * Mark notification as read
 */
app.post('/api/notifications/:id/read', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const marked = markNotificationAsRead(req.params.id, session.user.id);
  res.json({
    success: marked,
  });
});

/**
 * POST /api/wellness/check-in
 * Voluntary self-reported wellness mood check-in (not AI inferred, strictly opt-in)
 */
app.post('/api/wellness/check-in', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const rawMood = (req.body?.mood as string)?.trim();
  if (!rawMood) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Mood value is required.',
    });
  }

  const mood = sanitizeInputString(rawMood, 50);

  const checkIn = recordVoluntaryCheckIn(session.user.id, mood);
  res.status(201).json({
    success: true,
    checkIn,
  });
});

// ==============================================================================
// 5. DOWNLOAD PROJECT ZIP ENDPOINT
// ==============================================================================
app.get('/api/download-zip', async (req, res) => {
  try {
    const zipBuffer = await generateProjectZipBuffer(process.cwd());
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="niva-phase-9-final.zip"');
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.send(zipBuffer);
  } catch (error: any) {
    console.error('Error generating project zip:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to generate project archive',
      details: error.message,
    });
  }
});

// ==============================================================================
// 6. VITE MIDDLEWARE, WEBSOCKET SETUP & SERVER BOOTSTRAP
// ==============================================================================
async function startServer() {
  const httpServer = http.createServer(app);

  // Mount WebSocket server on /live
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/live',
  });
  setupVoiceWebSocketServer(wss);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌿 NIVA Phase 5 Server running at http://localhost:${PORT}`);
    console.log(`🎙️ Realtime Voice WebSocket: ws://localhost:${PORT}/live`);
    console.log(`🛡️ Health Check: http://localhost:${PORT}/health`);
    console.log(`📦 Project ZIP: http://localhost:${PORT}/api/download-zip`);
  });
}

const isMain =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs'));

if (isMain || process.env.RUN_SERVER === 'true') {
  startServer();
}
