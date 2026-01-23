type CacheKeyGenerator = (record: any) => string[];

export const cacheKeyPatterns: Partial<Record<string, CacheKeyGenerator>> = {
  User: (record) => [`user:${record.id}`],
};