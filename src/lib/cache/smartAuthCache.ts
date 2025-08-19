/**
 * Smart Authentication Cache with TTL
 * 
 * Provides intelligent caching for auth data with configurable TTL,
 * cache invalidation, and performance monitoring.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
  memoryUsage: number; // Approximate size in bytes
}

export interface SmartCacheOptions {
  defaultTtl?: number; // Default TTL in milliseconds
  maxEntries?: number; // Maximum cache entries
  cleanupInterval?: number; // Cleanup interval in milliseconds
  enableStats?: boolean; // Enable performance statistics
}

export class SmartAuthCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    cleanups: 0,
  };
  
  private options: Required<SmartCacheOptions>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: SmartCacheOptions = {}) {
    this.options = {
      defaultTtl: options.defaultTtl ?? 15 * 60 * 1000, // 15 minutes
      maxEntries: options.maxEntries ?? 100,
      cleanupInterval: options.cleanupInterval ?? 5 * 60 * 1000, // 5 minutes
      enableStats: options.enableStats ?? true,
    };

    this.startCleanupTimer();
  }

  /**
   * Store data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const entryTtl = ttl ?? this.options.defaultTtl;
    
    // Check if we need to evict entries
    if (this.cache.size >= this.options.maxEntries) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: entryTtl,
      hits: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
    
    if (this.options.enableStats) {
      console.log(`[SmartAuthCache] Set ${key} (TTL: ${entryTtl}ms)`);
    }
  }

  /**
   * Retrieve data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      if (this.options.enableStats) {
        console.log(`[SmartAuthCache] Expired ${key}`);
      }
      return null;
    }

    // Update access stats
    entry.hits++;
    entry.lastAccessed = now;
    this.stats.hits++;

    if (this.options.enableStats) {
      console.log(`[SmartAuthCache] Hit ${key} (${entry.hits} total hits)`);
    }

    return entry.data as T;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, cleanups: 0 };
    console.log('[SmartAuthCache] Cache cleared');
  }

  /**
   * Update TTL for existing entry
   */
  touch(key: string, newTtl?: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    if (newTtl !== undefined) {
      entry.ttl = newTtl;
    }
    entry.lastAccessed = now;

    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    // Calculate memory usage (approximate)
    const memoryUsage = entries.reduce((total, [key, entry]) => {
      return total + key.length * 2 + JSON.stringify(entry.data).length * 2 + 64; // Approximate overhead
    }, 0);

    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      oldestEntry: Math.min(...entries.map(([, entry]) => entry.timestamp)),
      newestEntry: Math.max(...entries.map(([, entry]) => entry.timestamp)),
      memoryUsage,
    };
  }

  /**
   * Get cache entry details
   */
  getEntryInfo(key: string): CacheEntry<any> | null {
    return this.cache.get(key) || null;
  }

  /**
   * List all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.stats.cleanups++;
    
    if (cleanedCount > 0 && this.options.enableStats) {
      console.log(`[SmartAuthCache] Cleaned up ${cleanedCount} expired entries`);
    }
  }

  /**
   * Evict oldest entry when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      if (this.options.enableStats) {
        console.log(`[SmartAuthCache] Evicted oldest entry: ${oldestKey}`);
      }
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Stop cleanup timer (for cleanup)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// Global cache instance
export const authCache = new SmartAuthCache({
  defaultTtl: 15 * 60 * 1000, // 15 minutes
  maxEntries: 50,
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  enableStats: process.env.NODE_ENV === 'development',
});

// Cache key helpers
export const CacheKeys = {
  USER_PROFILE: (userId: string) => `profile:${userId}`,
  SESSION_DATA: (sessionId: string) => `session:${sessionId}`,
  PERMISSIONS: (userId: string, resource: string) => `permissions:${userId}:${resource}`,
  ROLE_CHECK: (role: string, permissions: string) => `role:${role}:${permissions}`,
} as const;

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).authCache = authCache;
  console.log('🔧 Auth cache utilities available via window.authCache');
}
