import { describe, expect, it, vi } from 'vitest';
import { BasketMutationBatcher } from '../hooks/BasketMutationBatcher';

describe('BasketMutationBatcher', () => {
  it('coalesces repeated PLU intents and groups different products into one write', async () => {
    vi.useFakeTimers();
    try {
      const apply = vi.fn(async (_basketId: string, items: Array<{ plu: string; quantity: number }>) => ({
        items,
      }));
      const batcher = new BasketMutationBatcher(apply, 50);

      const first = batcher.enqueue({ basketId: 'basket-1', plu: 'A', quantity: 1 });
      const second = batcher.enqueue({ basketId: 'basket-1', plu: 'A', quantity: 3 });
      const third = batcher.enqueue({ basketId: 'basket-1', plu: 'B', quantity: 2 });

      await vi.advanceTimersByTimeAsync(50);
      const [a, b, c] = await Promise.all([first, second, third]);

      expect(apply).toHaveBeenCalledTimes(1);
      expect(apply).toHaveBeenCalledWith('basket-1', [
        { plu: 'A', quantity: 3 },
        { plu: 'B', quantity: 2 },
      ]);
      expect(a).toEqual(b);
      expect(b).toEqual(c);
    } finally {
      vi.useRealTimers();
    }
  });

  it('serializes later batches behind an in-flight authoritative write', async () => {
    vi.useFakeTimers();
    try {
      let releaseFirst!: () => void;
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      const calls: number[][] = [];
      const apply = vi.fn(async (_basketId: string, items: Array<{ plu: string; quantity: number }>) => {
        calls.push(items.map((item) => item.quantity));
        if (calls.length === 1) await firstGate;
        return { items };
      });
      const batcher = new BasketMutationBatcher(apply, 20);

      const first = batcher.enqueue({ basketId: 'basket-1', plu: 'A', quantity: 1 });
      await vi.advanceTimersByTimeAsync(20);
      const second = batcher.enqueue({ basketId: 'basket-1', plu: 'A', quantity: 2 });
      await vi.advanceTimersByTimeAsync(20);

      expect(apply).toHaveBeenCalledTimes(1);
      releaseFirst();
      await first;
      await second;
      expect(apply).toHaveBeenCalledTimes(2);
      expect(calls).toEqual([[1], [2]]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects every caller in a failed coalesced batch', async () => {
    vi.useFakeTimers();
    try {
      const batcher = new BasketMutationBatcher(
        async () => {
          throw new Error('upstream failed');
        },
        10
      );

      const first = batcher.enqueue({ basketId: 'basket-1', plu: 'A', quantity: 1 });
      const second = batcher.enqueue({ basketId: 'basket-1', plu: 'A', quantity: 2 });
      const firstOutcome = first.catch((error) => error);
      const secondOutcome = second.catch((error) => error);
      await vi.advanceTimersByTimeAsync(10);

      await expect(firstOutcome).resolves.toMatchObject({ message: 'upstream failed' });
      await expect(secondOutcome).resolves.toMatchObject({ message: 'upstream failed' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a pending burst before it is sent when the basket scope changes', async () => {
    vi.useFakeTimers();
    try {
      const apply = vi.fn(async () => ({ ok: true }));
      const batcher = new BasketMutationBatcher(apply, 100);
      const pending = batcher
        .enqueue({ basketId: 'basket-old', plu: 'A', quantity: 2 })
        .catch((error) => error);

      batcher.dispose(new Error('scope changed'));
      await vi.advanceTimersByTimeAsync(100);

      await expect(pending).resolves.toMatchObject({ message: 'scope changed' });
      expect(apply).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
