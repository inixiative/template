import { mock } from 'bun:test';

mock.module('#/jobs/queue', () => ({
  queue: { add: async () => ({ id: 'mock-1', name: 'x' }) },
}));
