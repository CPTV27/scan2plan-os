import memoizee from "memoizee";

/**
 * Caching Utilities
 * 
 * Provides typed wrappers around memoizee for common caching patterns
 */

export interface CacheOptions {
    /** Time-to-live in milliseconds */
    maxAge?: number;
    /** Maximum number of cached results */
    max?: number;
    /** Whether the function returns a promise */
    promise?: boolean;
}

/**
 * Creates a cached version of an async function
 * 
 * @example
 * const getCachedLeads = cacheAsync(
 *   async () => await storage.getLeads(),
 *   { maxAge: 5 * 60 * 1000 } // 5 minutes
 * );
 */
export function cacheAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: CacheOptions = {}
): T {
    return memoizee(fn, {
        promise: true,
        ...options,
    }) as T;
}

/**
 * Creates a cached version of a synchronous function
 */
export function cacheSync<T extends (...args: any[]) => any>(
    fn: T,
    options: CacheOptions = {}
): T {
    return memoizee(fn, {
        promise: false,
        ...options,
    }) as T;
}

/**
 * Common cache durations
 */
export const CacheDuration = {
    ONE_MINUTE: 60 * 1000,
    FIVE_MINUTES: 5 * 60 * 1000,
    FIFTEEN_MINUTES: 15 * 60 * 1000,
    THIRTY_MINUTES: 30 * 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    ONE_DAY: 24 * 60 * 60 * 1000,
} as const;
