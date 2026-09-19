import { Request, Response, NextFunction } from 'express';
import { BFFError } from './errors';

export interface RateLimiterOptions {
  windowMs: number; // Time window in milliseconds (e.g. 60000 for 1 minute)
  maxRequests: number; // Maximum requests allowed per window
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  message?: string;
}

interface ClientRecord {
  timestamps: number[];
}

export class RateLimiter {
  private records = new Map<string, ClientRecord>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly keyGenerator: (req: Request) => string;
  private readonly skip?: (req: Request) => boolean;
  private readonly message: string;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.skip = options.skip;
    this.message = options.message || 'Too many requests. Please slow down and try again later.';
    this.keyGenerator =
      options.keyGenerator ||
      ((req: Request) => {
        // Use x-forwarded-for, or connection IP, plus optional tenant or session header
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
        const tenantId = (req.headers['x-tenant-id'] as string) || '';
        return `${ip}:${tenantId}`;
      });

    // Run garbage collection every 60 seconds to prune expired buckets
    setInterval(() => this.cleanup(), 60000).unref();
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.skip && this.skip(req)) {
        return next();
      }

      const key = this.keyGenerator(req);
      const now = Date.now();
      const windowStart = now - this.windowMs;

      let record = this.records.get(key);
      if (!record) {
        record = { timestamps: [] };
        this.records.set(key, record);
      }

      // Filter out timestamps older than the window
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

      if (record.timestamps.length >= this.maxRequests) {
        const oldest = record.timestamps[0];
        const retryAfterSec = Math.ceil((oldest + this.windowMs - now) / 1000);

        res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
        res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', String(Math.ceil((oldest + this.windowMs) / 1000)));

        return next(
          new BFFError(
            'RATE_LIMIT_EXCEEDED',
            this.message,
            429,
            true,
            {
              limit: this.maxRequests,
              windowMs: this.windowMs,
              retryAfterSeconds: Math.max(1, retryAfterSec),
            }
          )
        );
      }

      record.timestamps.push(now);
      const remaining = Math.max(0, this.maxRequests - record.timestamps.length);
      res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(remaining));

      next();
    };
  }

  public reset(key?: string): void {
    if (key) {
      this.records.delete(key);
    } else {
      this.records.clear();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }
}

// Pre-configured rate limiters
export const standardApiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 300, // 300 requests per min for general API browsing
  skip: (req) => req.path === '/health' || req.path === '/ready' || req.path.startsWith('/@'),
});

export const checkoutAndPaymentRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 attempts per minute to prevent checkout spam & card testing
  message: 'Payment and checkout request threshold exceeded. Please wait a moment before trying again.',
});
