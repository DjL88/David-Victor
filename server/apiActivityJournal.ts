export type ApiActivitySourceStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'UNKNOWN';

export interface ApiActivityCursor {
  receivedAt: string;
  id: string;
}

export interface ApiActivityPage<T> {
  items: T[];
  status: Exclude<ApiActivitySourceStatus, 'UNKNOWN'>;
  source: 'FIRESTORE' | 'MEMORY';
  observedAt: string;
  nextCursor: string | null;
  errorCode?: string;
}

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,79}$/;

export function safeApiActivityErrorCode(value: unknown, fallback: string): string {
  const raw = value && typeof value === 'object' && 'code' in value
    ? (value as { code?: unknown }).code
    : '';
  const candidate = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');
  return ERROR_CODE_PATTERN.test(candidate) ? candidate : fallback;
}

export function encodeApiActivityCursor(cursor: ApiActivityCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeApiActivityCursor(value: unknown): ApiActivityCursor | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 512) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ApiActivityCursor>;
    const receivedAt = typeof parsed.receivedAt === 'string' ? parsed.receivedAt.trim() : '';
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    if (!receivedAt || !id || receivedAt.length > 64 || id.length > 240) return null;
    if (Number.isNaN(Date.parse(receivedAt))) return null;
    return { receivedAt, id };
  } catch {
    return null;
  }
}

export function compareApiActivityRecords(
  left: { receivedAt?: string; id?: string },
  right: { receivedAt?: string; id?: string }
): number {
  const time = String(right.receivedAt || '').localeCompare(String(left.receivedAt || ''));
  if (time !== 0) return time;
  return String(right.id || '').localeCompare(String(left.id || ''));
}

export function pageMemoryActivity<T>(
  values: T[],
  options: {
    limit: number;
    cursor?: string | null;
    receivedAt: (value: T) => string;
    id: (value: T) => string;
  }
): { items: T[]; nextCursor: string | null; invalidCursor: boolean } {
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 100));
  const cursor = options.cursor ? decodeApiActivityCursor(options.cursor) : null;
  if (options.cursor && !cursor) return { items: [], nextCursor: null, invalidCursor: true };

  const sorted = values.slice().sort((a, b) => compareApiActivityRecords(
    { receivedAt: options.receivedAt(a), id: options.id(a) },
    { receivedAt: options.receivedAt(b), id: options.id(b) }
  ));
  const eligible = cursor
    ? sorted.filter((item) => {
        const receivedAt = options.receivedAt(item);
        const id = options.id(item);
        return receivedAt < cursor.receivedAt ||
          (receivedAt === cursor.receivedAt && id < cursor.id);
      })
    : sorted;
  const items = eligible.slice(0, limit);
  const hasMore = eligible.length > limit;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last
      ? encodeApiActivityCursor({ receivedAt: options.receivedAt(last), id: options.id(last) })
      : null,
    invalidCursor: false,
  };
}
