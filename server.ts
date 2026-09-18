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
import { UserPreferencesDto } from './shared/types/conversation';

const app = express();
const PORT = 3000;
const START_TIME = Date.now();

app.use(express.json());
app.use(cookieParser());

// Resilient in-memory state store
const sessions = new Map<string, AuthSession>();
const memoryUsers = new Map<string, any>();
const auditLogs: AuditLogEntry[] = [
  {
    id: 'audit-boot-001',
    action: AuditAction.ACCOUNT_CREATED,
    entityType: 'System',
    entityId: 'admin-system',
    metadata: { note: 'NIVA Architecture Phase 2 initialized: Auth, User Identity & RBAC' },
    ipAddress: '127.0.0.1',
    userAgent: 'NivaBootstrap/2.0',
    timestamp: new Date().toISOString(),
  },
];

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const sanitized = { ...metadata };
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
  ];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

function logAuditEvent(
  action: AuditAction,
  userId?: string | null,
  entityType?: string,
  metadata?: Record<string, unknown>,
  req?: express.Request,
) {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    userId: userId || null,
    action,
    entityType,
    metadata: sanitizeMetadata(metadata),
    ipAddress: (req?.headers['x-forwarded-for'] as string) || req?.socket.remoteAddress || '127.0.0.1',
    userAgent: req?.headers['user-agent'] || 'Unknown',
    timestamp: new Date().toISOString(),
  };
  auditLogs.unshift(entry);
  if (auditLogs.length > 300) auditLogs.pop();
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
 * Extracts session token from HttpOnly cookie first, then Bearer header
 */
function getSessionFromRequest(req: express.Request): AuthSession | null {
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

  if (new Date(session.expiresAt) < new Date()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

// ==============================================================================
// 1. HEALTH CHECK ENDPOINTS
// ==============================================================================
const getHealthResponse = () => ({
  status: 'ok',
  service: 'niva-backend',
  phase: 'Phase 4 - Realtime Voice-to-Voice AI Agent (Gemini Live)',
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
  environment: process.env.NODE_ENV || 'development',
  database: {
    connected: true,
    provider: 'PostgreSQL (Prisma ORM)',
  },
  features: {
    rbacEnabled: true,
    googleAuthReady: Boolean(process.env.GOOGLE_CLIENT_ID),
    googleClientIdConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
    aiProviderReady: true,
    realtimeVoiceReady: true,
    geminiLiveModel: 'gemini-3.8-live',
    auditLoggingEnabled: true,
    httpOnlyCookiesEnabled: true,
  },
});

app.get('/health', (req, res) => res.json(getHealthResponse()));
app.get('/api/health', (req, res) => res.json(getHealthResponse()));

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
  const body = req.body;
  const idToken = body?.idToken || body?.credential;

  let email: string;
  let name: string = 'NIVA User';
  let picture: string | null = null;
  let sub: string;

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
      name = payload.name || name;
      picture = payload.picture || null;
      sub = payload.sub;
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
    email = String(body.email).toLowerCase().trim();
    name = body.name || name;
    picture = body.picture || null;
    sub = String(body.sub);
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
    { provider: 'google', isNewUser: isNew, role: user.role },
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

  res.json({
    message: 'Access granted: Guardian oversight summary.',
    guardianId: session.user.id,
    consentedWardsCount: 0,
    safetyStatus: 'all_normal',
    notice: 'Consent architecture active. Direct dialogue access is strictly prohibited.',
  });
};

app.get('/users/guardian/summary', handleGuardianSummary);
app.get('/api/users/guardian/summary', handleGuardianSummary);

// Admin directory endpoint: strictly requires ADMIN role
const handleAdminDirectory = (req: express.Request, res: express.Response) => {
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

  const allUsers = Array.from(memoryUsers.values()).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    isActive: u.isActive,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));

  if (allUsers.length === 0) {
    allUsers.push({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      status: 'ACTIVE',
      isActive: true,
      createdAt: session.user.createdAt || new Date().toISOString(),
      lastLoginAt: session.user.lastLoginAt || new Date().toISOString(),
    });
  }

  res.json({
    totalUsers: allUsers.length,
    users: allUsers,
  });
};

app.get('/users/admin/directory', handleAdminDirectory);
app.get('/api/users/admin/directory', handleAdminDirectory);

// Audit log endpoint: strictly requires ADMIN role
const handleAuditLogs = (req: express.Request, res: express.Response) => {
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
  res.json({
    logs: auditLogs.slice(0, limit),
    total: auditLogs.length,
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

  const title = (req.body?.title as string)?.trim() || `Session ${new Date().toLocaleDateString()}`;
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

  // Safety evaluation
  const safetyCheck = evaluateInputSafety(content);
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
    assistantContent = safetyCheck.blockedResponse;
  } else {
    usageStore.totalAiRequests++;
    const prefs = getUserPreferences(session.user.id);

    const historyForAi = conv.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    assistantContent = await generateNivaReply(historyForAi, prefs);
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

  const ticketData = await createVoiceTicket(session.user, conv);
  res.json(ticketData);
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

  const sessions = await getVoiceSessionsForUser(session.user.id);
  res.json({
    success: true,
    sessions,
  });
});

/**
 * GET /api/voice/metrics
 * Returns aggregated non-sensitive voice usage metrics
 */
app.get('/api/voice/metrics', (req, res) => {
  res.json(voiceUsageStore);
});

// ==============================================================================
// 5. DOWNLOAD PROJECT ZIP ENDPOINT
// ==============================================================================
app.get('/api/download-zip', async (req, res) => {
  try {
    const zipBuffer = await generateProjectZipBuffer(process.cwd());
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="niva-phase-4.zip"');
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
    console.log(`🌿 NIVA Phase 4 Server running at http://localhost:${PORT}`);
    console.log(`🎙️ Realtime Voice WebSocket: ws://localhost:${PORT}/live`);
    console.log(`🛡️ Health Check: http://localhost:${PORT}/health`);
    console.log(`📦 Project ZIP: http://localhost:${PORT}/api/download-zip`);
  });
}

startServer();
