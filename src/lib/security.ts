/**
 * NIVA Phase 8: Cybersecurity Utilities & Hardening
 *
 * Security Functions:
 * 1. RFC-compliant Email Validation
 * 2. Strict Input Sanitization & String Bounds
 * 3. Sensitive Data Redaction for Audit Logs (Passphrase, Token, Audio, Transcripts)
 * 4. In-Memory Rate Limiting for Authentication Endpoints
 */

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function sanitizeInputString(input: unknown, maxLength = 255): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, maxLength);
}

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /cookie/i,
  /credential/i,
  /bearer/i,
  /audio/i,
  /transcript/i,
  /conversation/i,
];

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const authRateLimitStore = new Map<string, { count: number; firstAttempt: number }>();
const AUTH_RATE_WINDOW_MS = 60 * 1000;
const AUTH_RATE_MAX_REQUESTS = 15;

export function checkAuthRateLimit(clientIp: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = authRateLimitStore.get(clientIp);

  if (!record || now - record.firstAttempt > AUTH_RATE_WINDOW_MS) {
    authRateLimitStore.set(clientIp, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: AUTH_RATE_MAX_REQUESTS - 1 };
  }

  if (record.count >= AUTH_RATE_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: AUTH_RATE_MAX_REQUESTS - record.count };
}

export function resetAuthRateLimits(): void {
  authRateLimitStore.clear();
}
