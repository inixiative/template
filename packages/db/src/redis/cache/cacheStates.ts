/**
 * @atlas
 * @kind type
 * @partOf primitive:caching
 * @uses none
 */
export const CACHE_STATES = ['empty', 'queued', 'computing', 'fresh', 'stale'] as const;

export type CacheState = (typeof CACHE_STATES)[number];

type HeldCacheState = Extract<CacheState, 'fresh' | 'stale'>;

export type CacheCheck<T> =
  | { state: Exclude<CacheState, HeldCacheState> }
  | {
      state: HeldCacheState;
      value: T;
      writtenAt?: Date;
      isComputing: boolean;
      isQueued: boolean;
    };
