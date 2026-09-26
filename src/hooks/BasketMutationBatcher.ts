export interface BasketQuantityMutation {
  basketId: string;
  plu: string;
  quantity: number;
}

interface PendingMutation<T> extends BasketQuantityMutation {
  waiters: Array<{
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
  }>;
}

/**
 * Coalesces a short burst of absolute basket quantity intents.
 *
 * - repeated writes for the same basket/PLU keep only the newest quantity;
 * - different PLUs in the same basket are sent together;
 * - batches remain serialized so an older authoritative response cannot race a newer one;
 * - every caller resolves/rejects with the authoritative result of the batch that
 *   contains its latest coalesced mutation.
 */
export class BasketMutationBatcher<T> {
  private pending = new Map<string, PendingMutation<T>>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(
    private readonly applyBatch: (
      basketId: string,
      items: Array<{ plu: string; quantity: number }>
    ) => Promise<T>,
    private readonly delayMs = 80
  ) {}

  enqueue(intent: BasketQuantityMutation): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error('Basket mutation batcher is disposed.'));
    }

    const key = `${intent.basketId}:${intent.plu}`;
    return new Promise<T>((resolve, reject) => {
      const existing = this.pending.get(key);
      if (existing) {
        existing.quantity = intent.quantity;
        existing.waiters.push({ resolve, reject });
      } else {
        this.pending.set(key, {
          ...intent,
          waiters: [{ resolve, reject }],
        });
      }

      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, this.delayMs);
    });
  }

  flushNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush();
  }

  dispose(reason = new Error('Basket mutation batcher was disposed.')): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const pending = Array.from(this.pending.values());
    this.pending.clear();
    for (const entry of pending) {
      for (const waiter of entry.waiters) waiter.reject(reason);
    }
  }

  private flush(): void {
    if (this.disposed || this.pending.size === 0) return;

    const snapshot = Array.from(this.pending.values());
    this.pending.clear();

    const byBasket = new Map<string, PendingMutation<T>[]>();
    for (const entry of snapshot) {
      const group = byBasket.get(entry.basketId) || [];
      group.push(entry);
      byBasket.set(entry.basketId, group);
    }

    for (const [basketId, entries] of byBasket) {
      this.chain = this.chain
        .then(async () => {
          try {
            const result = await this.applyBatch(
              basketId,
              entries.map(({ plu, quantity }) => ({ plu, quantity }))
            );
            for (const entry of entries) {
              for (const waiter of entry.waiters) waiter.resolve(result);
            }
          } catch (error) {
            for (const entry of entries) {
              for (const waiter of entry.waiters) waiter.reject(error);
            }
          }
        })
        .catch(() => {
          // Individual waiters receive the error above; keep later batches alive.
        });
    }
  }
}
