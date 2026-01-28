import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { adminJobRouter } from '#/modules/admin/job';
import type { JobEnqueueResponse } from '#/modules/admin/job/routes/jobEnqueue';
import { createTestApp } from '#tests/createTestApp';
import { json, jsonError, post } from '#tests/utils/request';

describe('admin/job', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;

    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/admin/job', adminJobRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('POST /api/admin/job', () => {
    it('enqueues a job with valid handler', async () => {
      const response = await fetch(
        post('/api/admin/job', {
          handler: 'sendWebhook',
          payload: { test: true },
        }),
      );
      const { data } = await json<JobEnqueueResponse>(response);

      expect(response.status).toBe(201);
      expect(data.name).toBe('sendWebhook');
      expect(data.enqueuedAt).toBeDefined();
    });

    it('enqueues a job with options', async () => {
      const response = await fetch(
        post('/api/admin/job', {
          handler: 'sendWebhook',
          payload: { url: 'https://example.com' },
          options: {
            priority: 5,
            delay: 1000,
            attempts: 3,
          },
        }),
      );
      const { data } = await json<JobEnqueueResponse>(response);

      expect(response.status).toBe(201);
      expect(data.name).toBe('sendWebhook');
    });

    it('rejects invalid handler name', async () => {
      const response = await fetch(
        post('/api/admin/job', {
          handler: 'invalidHandler',
          payload: {},
        }),
      );
      const body = await jsonError(response);

      expect(response.status).toBe(400);
      expect(body.error).toBeDefined();
    });
  });
});
