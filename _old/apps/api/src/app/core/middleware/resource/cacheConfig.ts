// Resource cache configuration (TTL in seconds or boolean)
// - number: cache for specified seconds
// - true: cache with default TTL (24 hours)
// - false: no caching
export const resourceCacheConfig: Record<string, number | boolean> = {
  user: 3600,      // 1 hour
  account: 3600,   // 1 hour
  session: 300,    // 5 minutes
  // Add more resources as needed
};