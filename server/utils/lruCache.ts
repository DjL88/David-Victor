/**
 * High-performance, memory-bounded Least Recently Used (LRU) Cache with TTL.
 * Prevents memory leaks and unbound cache growth under large multi-tenant load
 * (500–850 stores per tenant, thousands of coordinate searches).
 * Section 45: "Target tenant size ~500-850 stores. Use server cache, request coalescing, bounded candidate sets."
 */

export interface LRUCacheOptions {
  maxSize: number;
  defaultTtlMs: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

interface CacheNode<K, V> {
  key: K;
  value: V;
  expiresAt: number;
  prev?: CacheNode<K, V>;
  next?: CacheNode<K, V>;
}

export class LRUCache<K, V> {
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly map = new Map<K, CacheNode<K, V>>();
  private head?: CacheNode<K, V>;
  private tail?: CacheNode<K, V>;

  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(optionsOrMaxSize: LRUCacheOptions | number, maybeTtlMs?: number) {
    if (typeof optionsOrMaxSize === 'number') {
      this.maxSize = Math.max(1, optionsOrMaxSize);
      this.defaultTtlMs = maybeTtlMs ?? 5 * 60 * 1000;
    } else {
      this.maxSize = Math.max(1, optionsOrMaxSize.maxSize);
      this.defaultTtlMs = optionsOrMaxSize.defaultTtlMs;
    }
  }

  public get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    const now = Date.now();
    if (node.expiresAt <= now) {
      this.deleteNode(node);
      this.misses++;
      return undefined;
    }

    this.hits++;
    this.moveToHead(node);
    return node.value;
  }

  public set(key: K, value: V, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs !== undefined ? ttlMs : this.defaultTtlMs);

    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = expiresAt;
      this.moveToHead(existing);
      return;
    }

    if (this.map.size >= this.maxSize) {
      this.evictTail();
    }

    const newNode: CacheNode<K, V> = {
      key,
      value,
      expiresAt,
    };

    this.map.set(key, newNode);
    this.addToHead(newNode);
  }

  public has(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    if (node.expiresAt <= Date.now()) {
      this.deleteNode(node);
      return false;
    }
    return true;
  }

  public delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.deleteNode(node);
    return true;
  }

  public clear(): void {
    this.map.clear();
    this.head = undefined;
    this.tail = undefined;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  public getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? Number((this.hits / total).toFixed(4)) : 0;
    return {
      size: this.map.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate,
    };
  }

  private moveToHead(node: CacheNode<K, V>): void {
    if (this.head === node) return;
    this.detach(node);
    this.addToHead(node);
  }

  private addToHead(node: CacheNode<K, V>): void {
    node.prev = undefined;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private detach(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else if (this.head === node) {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else if (this.tail === node) {
      this.tail = node.prev;
    }

    node.prev = undefined;
    node.next = undefined;
  }

  private deleteNode(node: CacheNode<K, V>): void {
    this.map.delete(node.key);
    this.detach(node);
  }

  private evictTail(): void {
    if (!this.tail) return;
    this.evictions++;
    const nodeToEvict = this.tail;
    this.deleteNode(nodeToEvict);
  }
}
