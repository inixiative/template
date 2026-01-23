import { Elysia } from 'elysia';
import Redis from 'ioredis';

export const redis = new Elysia({ name: 'redis' })
  .decorate('redis', {
    cache: new Redis(process.env.REDIS_CACHE_URL!),
    queue: new Redis(process.env.REDIS_QUEUE_URL!)
  });