import { mock } from 'bun:test';
import { getRedisClient } from '@template/db';

let jobCounter = 0;

mock.module('#/jobs/queue', () => ({
  queue: {
    add: async (name: string) => ({ id: `mock-${++jobCounter}`, name }),
    getJobs: async () => [],
    redis: getRedisClient(),
  },
}));
