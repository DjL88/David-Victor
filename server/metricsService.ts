export interface MetricCounter {
  [key: string]: number;
}

export interface MetricHistogram {
  count: number;
  sum: number;
  min: number;
  max: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

export interface UpstreamMetric {
  calls: number;
  failures: number;
  totalDurationMs: number;
  avgDurationMs: number;
}

export interface MetricsSnapshot {
  timestamp: string;
  uptimeSeconds: number;
  api: {
    totalRequests: number;
    requestsByStatus: Record<string, number>;
    requestsByPath: Record<string, number>;
    latency: {
      avgMs: number;
      minMs: number;
      maxMs: number;
    };
  };
  upstreams: {
    commerce: UpstreamMetric;
    dispatch: UpstreamMetric;
    dpay: UpstreamMetric;
    webhooks: {
      received: number;
      verified: number;
      rejected: number;
      duplicates: number;
      processed: number;
      errors: number;
    };
  };
  cache: {
    hits: number;
    misses: number;
    hitRatePct: number;
  };
  circuitBreakers: Record<string, { state: string; failures: number; trips: number }>;
}

export class MetricsService {
  private static startTime = Date.now();

  private static totalRequests = 0;
  private static statusCounts: Record<string, number> = {};
  private static pathCounts: Record<string, number> = {};
  private static latencies: number[] = [];

  private static upstreams: Record<string, { calls: number; failures: number; durations: number[] }> = {
    commerce: { calls: 0, failures: 0, durations: [] },
    dispatch: { calls: 0, failures: 0, durations: [] },
    dpay: { calls: 0, failures: 0, durations: [] },
  };

  private static webhooks = {
    received: 0,
    verified: 0,
    rejected: 0,
    duplicates: 0,
    processed: 0,
    errors: 0,
  };

  private static cache = {
    hits: 0,
    misses: 0,
  };

  public static recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    this.totalRequests += 1;
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    this.statusCounts[statusGroup] = (this.statusCounts[statusGroup] || 0) + 1;

    // Normalize path to prevent high cardinality
    const normalizedPath = this.normalizePath(path);
    const key = `${method} ${normalizedPath}`;
    this.pathCounts[key] = (this.pathCounts[key] || 0) + 1;

    // Retain sliding window of up to 1000 latencies
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }
    this.latencies.push(durationMs);
  }

  public static recordUpstreamCall(upstream: 'commerce' | 'dispatch' | 'dpay', success: boolean, durationMs: number): void {
    if (!this.upstreams[upstream]) {
      this.upstreams[upstream] = { calls: 0, failures: 0, durations: [] };
    }
    this.upstreams[upstream].calls += 1;
    if (!success) {
      this.upstreams[upstream].failures += 1;
    }
    if (this.upstreams[upstream].durations.length > 500) {
      this.upstreams[upstream].durations.shift();
    }
    this.upstreams[upstream].durations.push(durationMs);
  }

  public static recordWebhook(type: 'received' | 'verified' | 'rejected' | 'duplicates' | 'processed' | 'errors'): void {
    if (this.webhooks[type] !== undefined) {
      this.webhooks[type] += 1;
    }
  }

  public static recordCache(hit: boolean): void {
    if (hit) {
      this.cache.hits += 1;
    } else {
      this.cache.misses += 1;
    }
  }

  public static getSnapshot(circuitBreakerStats?: Record<string, { state: string; failures: number; totalTrips: number }>): MetricsSnapshot {
    return this.getMetricsSnapshot(circuitBreakerStats);
  }

  public static getMetricsSnapshot(circuitBreakerStats?: Record<string, { state: string; failures: number; totalTrips: number }>): MetricsSnapshot {
    const latenciesSorted = [...this.latencies].sort((a, b) => a - b);
    const avgLatency = latenciesSorted.length > 0 ? latenciesSorted.reduce((a, b) => a + b, 0) / latenciesSorted.length : 0;
    const minLatency = latenciesSorted.length > 0 ? latenciesSorted[0] : 0;
    const maxLatency = latenciesSorted.length > 0 ? latenciesSorted[latenciesSorted.length - 1] : 0;

    const calcUpstream = (data: { calls: number; failures: number; durations: number[] }): UpstreamMetric => ({
      calls: data.calls,
      failures: data.failures,
      totalDurationMs: data.durations.reduce((a, b) => a + b, 0),
      avgDurationMs: data.durations.length > 0 ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length : 0,
    });

    const totalCacheAccess = this.cache.hits + this.cache.misses;
    const hitRatePct = totalCacheAccess > 0 ? Math.round((this.cache.hits / totalCacheAccess) * 100) : 100;

    const cbSnapshot: Record<string, { state: string; failures: number; trips: number }> = {};
    if (circuitBreakerStats) {
      for (const [key, val] of Object.entries(circuitBreakerStats)) {
        cbSnapshot[key] = {
          state: val.state,
          failures: val.failures,
          trips: val.totalTrips,
        };
      }
    }

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      api: {
        totalRequests: this.totalRequests,
        requestsByStatus: { ...this.statusCounts },
        requestsByPath: { ...this.pathCounts },
        latency: {
          avgMs: Math.round(avgLatency * 10) / 10,
          minMs: minLatency,
          maxMs: maxLatency,
        },
      },
      upstreams: {
        commerce: calcUpstream(this.upstreams.commerce),
        dispatch: calcUpstream(this.upstreams.dispatch),
        dpay: calcUpstream(this.upstreams.dpay),
        webhooks: { ...this.webhooks },
      },
      cache: {
        hits: this.cache.hits,
        misses: this.cache.misses,
        hitRatePct,
      },
      circuitBreakers: cbSnapshot,
    };
  }

  public static reset(): void {
    this.totalRequests = 0;
    this.statusCounts = {};
    this.pathCounts = {};
    this.latencies = [];
    this.upstreams = {
      commerce: { calls: 0, failures: 0, durations: [] },
      dispatch: { calls: 0, failures: 0, durations: [] },
      dpay: { calls: 0, failures: 0, durations: [] },
    };
    this.webhooks = {
      received: 0,
      verified: 0,
      rejected: 0,
      duplicates: 0,
      processed: 0,
      errors: 0,
    };
    this.cache = { hits: 0, misses: 0 };
  }

  private static normalizePath(urlPath: string): string {
    return urlPath
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:id')
      .replace(/\/stores\/[a-zA-Z0-9_-]+/g, '/stores/:channelLinkId')
      .replace(/\/baskets\/[a-zA-Z0-9_-]+/g, '/baskets/:basketId')
      .replace(/\/orders\/[a-zA-Z0-9_-]+/g, '/orders/:orderId')
      .replace(/\/checkouts\/[a-zA-Z0-9_-]+/g, '/checkouts/:checkoutId');
  }
}
