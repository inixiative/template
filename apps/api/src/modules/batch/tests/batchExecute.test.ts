import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db';
import { cleanupTouchedTables, createUser, getNextSeq } from '@template/db/test';
import { batchRouter } from '#/modules/batch';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

describe('POST /api/v1/batch/execute', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;

  beforeAll(async () => {
    const { entity } = await createUser();
    user = entity;

    const harness = createTestApp({
      mockUser: user,
      mount: [
        (app) => app.route('/api/v1/batch', batchRouter),
        (app) => app.route('/api/v1/me', meRouter),
        (app) => app.route('/api/v1/organization', organizationRouter),
      ],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('Basic functionality', () => {
    it('executes single round with single request', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [[{ method: 'GET', path: '/api/v1/me' }]],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(1);
      expect(data.batch[0]).toHaveLength(1);
      expect(data.batch[0][0].status).toBe(200);
      expect(data.summary.totalRequests).toBe(1);
      expect(data.summary.failedRequests).toBe(0);
    });

    it('executes multiple requests in parallel within one round', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              { method: 'GET', path: '/api/v1/me' },
              { method: 'GET', path: '/api/v1/me/organizations' },
            ],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(1);
      expect(data.batch[0]).toHaveLength(2);
      expect(data.batch[0][0].status).toBe(200);
      expect(data.batch[0][1].status).toBe(200);
      expect(data.summary.totalRequests).toBe(2);
    });

    it('interpolates values from previous round', async () => {
      const seq = getNextSeq();
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: { name: `Test Org ${seq}`, slug: `test-org-${seq}` },
              },
            ],
            [{ method: 'GET', path: '/api/v1/organization/<<0.0.body.data.id>>' }],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(2);
      expect(data.batch[0][0].status).toBe(201);
      expect(data.batch[1][0].status).toBe(200);
      expect(data.batch[1][0].body.data.slug).toBe(`test-org-${seq}`);
    });

    it('applies shared headers to all requests', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [[{ method: 'GET', path: '/api/v1/me' }]],
          headers: { 'X-Custom-Header': 'test-value' },
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch[0][0].status).toBe(200);
    });

    it('allows request-specific headers to override shared headers', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'GET',
                path: '/api/v1/me',
                headers: { 'X-Custom': 'override' },
              },
            ],
          ],
          headers: { 'X-Custom': 'shared' },
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch[0][0].status).toBe(200);
    });
  });

  describe('Strategy: transactionAll', () => {
    it('commits all operations on success', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: { name: 'Test Org 1', slug: `test-org-1-${Date.now()}` },
              },
            ],
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: { name: 'Test Org 2', slug: `test-org-2-${Date.now()}` },
              },
            ],
          ],
          strategy: 'transactionAll',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(2);
      expect(data.batch[0][0].status).toBe(201);
      expect(data.batch[1][0].status).toBe(201);

      const org1Id = data.batch[0][0].body.data.id;
      const org2Id = data.batch[1][0].body.data.id;

      const org1 = await db.organization.findUnique({ where: { id: org1Id } });
      const org2 = await db.organization.findUnique({ where: { id: org2Id } });

      expect(org1).toBeDefined();
      expect(org2).toBeDefined();
    });

    it('rolls back all operations on any failure', async () => {
      const uniqueSlug = `test-org-rollback-${Date.now()}`;

      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: { name: 'Should Rollback', slug: uniqueSlug },
              },
            ],
            [
              {
                method: 'GET',
                path: '/api/v1/organization/invalid-id-will-fail',
              },
            ],
          ],
          strategy: 'transactionAll',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.summary.status).toBe('failed');

      const org = await db.organization.findFirst({ where: { slug: uniqueSlug } });
      expect(org).toBeNull();
    });
  });

  describe('Strategy: transactionPerRound', () => {
    it('commits each round independently', async () => {
      const slug1 = `test-per-round-1-${Date.now()}`;
      const slug2 = `test-per-round-2-${Date.now()}`;

      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: { name: 'Round 1 Org', slug: slug1 },
              },
            ],
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: { name: 'Round 2 Org', slug: slug2 },
              },
            ],
          ],
          strategy: 'transactionPerRound',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(2);

      const org1 = await db.organization.findFirst({ where: { slug: slug1 } });
      const org2 = await db.organization.findFirst({ where: { slug: slug2 } });

      expect(org1).toBeDefined();
      expect(org2).toBeDefined();
    });

    it('commits successful rounds before failure', async () => {
      const successSlug = `test-committed-${Date.now()}`;

      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: { name: 'Should Commit', slug: successSlug },
              },
            ],
            [
              {
                method: 'GET',
                path: '/api/v1/organization/invalid-id',
              },
            ],
          ],
          strategy: 'transactionPerRound',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.summary.status).toBe('partialSuccess');
      expect(data.summary.completedRounds).toBe(1);

      const org = await db.organization.findFirst({ where: { slug: successSlug } });
      expect(org).toBeDefined();
    });
  });

  describe('Strategy: allowFailures', () => {
    it('continues through all rounds regardless of failures', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [{ method: 'GET', path: '/api/v1/organization/invalid-id-1' }],
            [{ method: 'GET', path: '/api/v1/me' }],
            [{ method: 'GET', path: '/api/v1/organization/invalid-id-2' }],
            [{ method: 'GET', path: '/api/v1/me/organizations' }],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(4);
      expect(data.batch[0][0].error).toBeDefined();
      expect(data.batch[1][0].status).toBe(200);
      expect(data.batch[2][0].error).toBeDefined();
      expect(data.batch[3][0].status).toBe(200);
      expect(data.summary.failedRequests).toBe(2);
    });

    it('tries all requests in a round even if some fail', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              { method: 'GET', path: '/api/v1/organization/invalid-id' },
              { method: 'GET', path: '/api/v1/me' },
              { method: 'GET', path: '/api/v1/organization/another-invalid' },
            ],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch[0]).toHaveLength(3);
      expect(data.batch[0][0].error).toBeDefined();
      expect(data.batch[0][1].status).toBe(200);
      expect(data.batch[0][2].error).toBeDefined();
    });
  });

  describe('Strategy: failOnRound', () => {
    it('stops after first round with failures', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [{ method: 'GET', path: '/api/v1/me' }],
            [{ method: 'GET', path: '/api/v1/organization/invalid-id' }],
            [{ method: 'GET', path: '/api/v1/me/organizations' }],
          ],
          strategy: 'failOnRound',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(2);
      expect(data.batch[0][0].status).toBe(200);
      expect(data.batch[1][0].error).toBeDefined();
    });

    it('completes all requests in the failing round', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              { method: 'GET', path: '/api/v1/organization/invalid-1' },
              { method: 'GET', path: '/api/v1/me' },
              { method: 'GET', path: '/api/v1/organization/invalid-2' },
            ],
            [{ method: 'GET', path: '/api/v1/me/organizations' }],
          ],
          strategy: 'failOnRound',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(1);
      expect(data.batch[0]).toHaveLength(3);
      expect(data.batch[0][0].error).toBeDefined();
      expect(data.batch[0][1].status).toBe(200);
      expect(data.batch[0][2].error).toBeDefined();
    });

    it('continues through all rounds if no failures', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [{ method: 'GET', path: '/api/v1/me' }],
            [{ method: 'GET', path: '/api/v1/me/organizations' }],
            [{ method: 'GET', path: '/api/v1/me/spaces' }],
          ],
          strategy: 'failOnRound',
        }),
      );

      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(3);
      expect(data.batch[0][0].status).toBe(200);
      expect(data.batch[1][0].status).toBe(200);
      expect(data.batch[2][0].status).toBe(200);
    });
  });

  describe('Security validations', () => {
    it('rejects malformed interpolation syntax', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [{ method: 'GET', path: '/api/v1/me' }],
            [{ method: 'GET', path: '/api/v1/organization/<<invalid>>' }],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);
      expect(response.status).toBe(200);
      expect(data.batch[1][0].status).toBe(500);
      expect(data.batch[1][0].error).toContain('Malformed interpolation syntax');
    });

    it('rejects nested interpolation', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [{ method: 'GET', path: '/api/v1/me' }],
            [{ method: 'GET', path: '/api/v1/organization/<<0.0.<<1.0.id>>>>' }],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);
      expect(response.status).toBe(200);
      expect(data.batch[1][0].status).toBe(500);
      expect(data.batch[1][0].error).toContain('Nested interpolation');
    });

    it('rejects current round reference', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [{ method: 'GET', path: '/api/v1/me' }],
            [{ method: 'GET', path: '/api/v1/organization/<<1.0.id>>' }],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);
      expect(response.status).toBe(200);
      expect(data.batch[1][0].status).toBe(500);
      expect(data.batch[1][0].error).toContain('Invalid round reference');
    });

    it('rejects future round reference', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [{ method: 'GET', path: '/api/v1/me' }],
            [{ method: 'GET', path: '/api/v1/organization/<<2.0.id>>' }],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);
      expect(response.status).toBe(200);
      expect(data.batch[1][0].status).toBe(500);
      expect(data.batch[1][0].error).toContain('Invalid round reference');
    });

    it('rejects absolute URLs', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [[{ method: 'GET', path: 'https://evil.com/api' }]],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await json(response);
      expect(response.status).toBe(200);
      expect(data.batch[0][0].status).toBe(500);
      expect(data.batch[0][0].error).toContain('Absolute URLs are not allowed');
    });

    it('enforces maximum rounds limit', async () => {
      const tooManyRounds = Array(11).fill([{ method: 'GET', path: '/api/v1/me' }]);

      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: tooManyRounds,
          strategy: 'allowFailures',
        }),
      );

      expect(response.status).toBe(400);
    });

    it('enforces maximum requests per round limit', async () => {
      const tooManyRequests = Array(51).fill({ method: 'GET', path: '/api/v1/me' });

      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [tooManyRequests],
          strategy: 'allowFailures',
        }),
      );

      expect(response.status).toBe(400);
    });
  });
});
