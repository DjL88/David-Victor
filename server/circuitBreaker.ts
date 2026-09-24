import { BFFError } from './errors';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number; // Consecutive failures before opening circuit (default: 5)
  successThreshold?: number; // Consecutive successes in HALF_OPEN before closing (default: 2)
  cooldownMs?: number; // Time in ms to remain OPEN before trying HALF_OPEN (default: 15000)
  timeoutMs?: number; // Execution timeout in ms (default: 10000)
}

export interface CircuitStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastStateChange: number;
  totalTrips: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: number;
  private lastStateChange: number = Date.now();
  private totalTrips: number = 0;

  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly cooldownMs: number;
  private readonly timeoutMs: number;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.cooldownMs = options.cooldownMs ?? 15000;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - (this.lastFailureTime ?? 0);
      if (timeSinceFailure >= this.cooldownMs) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  public getStats(): CircuitStats {
    return {
      name: this.name,
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalTrips: this.totalTrips,
    };
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new BFFError(
        'UPSTREAM_CIRCUIT_OPEN',
        `The upstream service (${this.name}) is temporarily experiencing failures. Circuit is OPEN.`,
        503,
        true,
        { service: this.name, cooldownRemainingMs: Math.max(0, this.cooldownMs - (Date.now() - (this.lastFailureTime ?? 0))) }
      );
    }

    try {
      // Execute with timeout guard
      const result = await Promise.race([
        action(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new BFFError(
                  'UPSTREAM_TIMEOUT',
                  `Upstream service (${this.name}) timed out after ${this.timeoutMs}ms.`,
                  504,
                  true,
                  { service: this.name, timeoutMs: this.timeoutMs }
                )
              ),
            this.timeoutMs
          )
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successes += 1;
      if (this.successes >= this.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.failures = 0;
    }
  }

  private onFailure(error: any): void {
    const status = Number(error?.statusCode ?? error?.status ?? error?.response?.status);
    // Client/request failures say nothing about upstream health. They must never
    // poison a tenant's circuit or another tenant's traffic.
    if (Number.isFinite(status) && status >= 400 && status < 500) {
      return;
    }

    this.lastFailureTime = Date.now();
    this.failures += 1;

    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === 'OPEN') {
      this.totalTrips += 1;
      this.successes = 0;
      console.warn(`[CircuitBreaker] [${this.name}] TRIPPED from ${oldState} to OPEN (Failures: ${this.failures})`);
    } else if (newState === 'HALF_OPEN') {
      this.successes = 0;
      console.info(`[CircuitBreaker] [${this.name}] Probing recovery: transitioned to HALF_OPEN`);
    } else if (newState === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
      console.info(`[CircuitBreaker] [${this.name}] Successfully recovered: transitioned to CLOSED`);
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.lastStateChange = Date.now();
  }

  public trip(): void {
    this.transitionTo('OPEN');
  }
}

/**
 * Exponential backoff retry utility with jitter.
 * Designed for idempotent operations (e.g. read-only catalog queries, token refreshes, status polls).
 */
export async function executeWithRetry<T>(
  action: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    retryIf?: (err: any) => boolean;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 2000;

  const defaultRetryIf = (err: any): boolean => {
    if (!err) return false;
    // Don't retry non-retryable 4xx client errors
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
      return false;
    }
    if (err instanceof BFFError && !err.retryable) {
      return false;
    }
    return true;
  };

  const shouldRetry = options.retryIf ?? defaultRetryIf;

  let attempt = 0;
  while (true) {
    try {
      return await action();
    } catch (error) {
      attempt += 1;
      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate backoff with full jitter
      const exponentialDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt - 1));
      const jitterDelay = Math.floor(Math.random() * exponentialDelay);

      await new Promise((resolve) => setTimeout(resolve, jitterDelay));
    }
  }
}

export type CircuitService = 'commerce' | 'dispatch' | 'dpay';

const tenantCircuitBreakers = new Map<string, CircuitBreaker>();

const serviceOptions: Record<CircuitService, Omit<CircuitBreakerOptions, 'name'>> = {
  commerce: { failureThreshold: 5, cooldownMs: 15000, timeoutMs: 10000 },
  dispatch: { failureThreshold: 4, cooldownMs: 20000, timeoutMs: 8000 },
  dpay: { failureThreshold: 3, cooldownMs: 30000, timeoutMs: 12000 },
};

/** SEC-04b: circuit state is isolated by tenant + upstream service. */
export function getCircuitBreaker(
  tenantId: string,
  service: CircuitService
): CircuitBreaker {
  const cleanTenant = String(tenantId || '').trim() || 'unknown';
  const key = `${cleanTenant}:${service}`;
  let breaker = tenantCircuitBreakers.get(key);
  if (!breaker) {
    breaker = new CircuitBreaker({
      name: key,
      ...serviceOptions[service],
    });
    tenantCircuitBreakers.set(key, breaker);
  }
  return breaker;
}

export function getCircuitBreakerStats(): Record<string, CircuitStats> {
  return Object.fromEntries(
    Array.from(tenantCircuitBreakers.entries()).map(([key, breaker]) => [
      key,
      breaker.getStats(),
    ])
  );
}

export function resetCircuitBreakersForTest(): void {
  tenantCircuitBreakers.clear();
}

// Backwards-compatible diagnostics only. Runtime integration calls should use
// getCircuitBreaker(tenantId, service) so one tenant cannot trip another.
export const circuitBreakers = {
  commerce: getCircuitBreaker('platform-diagnostics', 'commerce'),
  dispatch: getCircuitBreaker('platform-diagnostics', 'dispatch'),
  dpay: getCircuitBreaker('platform-diagnostics', 'dpay'),
};
