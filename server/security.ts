import type { NextFunction, Request, Response } from 'express';

const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /(Bearer\s+)[A-Za-z0-9._-]+/gi,
  /(api[_-]?key\s*[:=]\s*["']?)[A-Za-z0-9_-]{12,}/gi,
  /([?&]key=)[^&\s"']+/gi,
];

export function sanitizeErrorMessage(raw: string): string {
  let clean = raw || '';
  clean = clean.replace(SECRET_PATTERNS[0], '[REDACTED_API_KEY]');
  clean = clean.replace(SECRET_PATTERNS[1], '$1[REDACTED_TOKEN]');
  clean = clean.replace(SECRET_PATTERNS[2], '$1[REDACTED_KEY]');
  clean = clean.replace(SECRET_PATTERNS[3], '$1[REDACTED_KEY]');
  return clean;
}

export function parseAllowedOrigins(
  corsOriginsEnv?: string,
  extraOrigins: Array<string | undefined> = []
): string[] {
  const fromEnv = (corsOriginsEnv ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const normalizedExtras = extraOrigins
    .map((o) => o?.trim())
    .filter((o): o is string => Boolean(o))
    .map((o) => {
      try {
        return new URL(o).origin;
      } catch {
        return o;
      }
    });

  return Array.from(new Set([...fromEnv, ...normalizedExtras]));
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  hostHeader?: string,
  isProduction = false
): boolean {
  // Same-origin non-CORS requests or server health checks omit Origin
  if (!origin) return true;

  if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }

  if (allowedOrigins.includes('*')) return true;
  if (allowedOrigins.includes(origin)) return true;

  if (hostHeader) {
    try {
      const parsed = new URL(origin);
      if (parsed.host === hostHeader) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

export function createCorsMiddleware(options: {
  allowedOrigins: string[];
  isProduction: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    const hostHeader = req.headers.host;

    if (!origin) {
      next();
      return;
    }

    const allowed = isOriginAllowed(
      origin,
      options.allowedOrigins,
      hostHeader,
      options.isProduction
    );

    if (!allowed) {
      if (req.path.startsWith('/api/')) {
        res.status(403).json({ error: '허용되지 않은 출처(CORS)에서의 API 요청입니다.' });
        return;
      }
      next();
      return;
    }

    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self)');
  next();
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
}

export class InMemoryRateLimiter {
  private readonly windowMs: number;
  private readonly max: number;
  private readonly maxEntries: number;
  private readonly store = new Map<string, { count: number; resetAtMs: number }>();

  constructor(options: { windowMs: number; max: number; maxEntries?: number }) {
    this.windowMs = Math.max(1000, options.windowMs);
    this.max = Math.max(1, options.max);
    this.maxEntries = options.maxEntries ?? 5000;
  }

  check(key: string, nowMs = Date.now()): RateLimitDecision {
    if (this.store.size > this.maxEntries) {
      for (const [k, v] of this.store.entries()) {
        if (v.resetAtMs <= nowMs) {
          this.store.delete(k);
        }
      }
    }

    const existing = this.store.get(key);
    if (!existing || existing.resetAtMs <= nowMs) {
      const resetAtMs = nowMs + this.windowMs;
      this.store.set(key, { count: 1, resetAtMs });
      return {
        allowed: true,
        limit: this.max,
        remaining: Math.max(0, this.max - 1),
        resetAtMs,
      };
    }

    existing.count += 1;
    const allowed = existing.count <= this.max;
    return {
      allowed,
      limit: this.max,
      remaining: Math.max(0, this.max - existing.count),
      resetAtMs: existing.resetAtMs,
    };
  }
}

export function createRateLimitMiddleware(options: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}) {
  const limiter = new InMemoryRateLimiter({
    windowMs: options.windowMs,
    max: options.max,
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix ?? 'global'}:${clientIp}`;
    const decision = limiter.check(key);

    res.setHeader('RateLimit-Limit', String(decision.limit));
    res.setHeader('RateLimit-Remaining', String(decision.remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(decision.resetAtMs / 1000)));

    if (!decision.allowed) {
      res.status(429).json({
        error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
      });
      return;
    }

    next();
  };
}
