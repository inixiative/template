export const cached = (redis: { get: (key: string) => Promise<string | null> }, key: string) => redis.get(key);
