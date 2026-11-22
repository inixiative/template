import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createUser, nextFactorySequenceNumber } from '@template/db/test';
import { batchRouter } from '#/modules/batch';
import type { batchExecuteRoute } from '#/modules/batch/routes/batchExecute';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { tokenRouter } from '#/modules/token';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { parseErrorBody, parseSuccessBody, post } from '#tests/utils/request';

type BatchExecuteResponse = z.infer<typeof batchExecuteRoute.responseSchema>;

const routers: MountFn[] = [
  (app) => app.route('/api/v1/batch', batchRouter),
  (app) => app.route('/api/v1/me', meRouter),
  (app) => app.route('/api/v1/organization', organizationRouter),
  (app) => app.route('/api/v1/token', tokenRouter),
];

const memberlessUserFetch = async () =>
  createTestApp({ mockUser: (await createUser()).entity, mount: routers }).fetch;

describe('POST /api/v1/batch/execute', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;

  beforeEach(async () => {
    const { entity } = await createUser();
    user = entity;

    const harness = createTestApp({ mockUser: user, mount: routers });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterEach(async () => {
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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(1);
      expect(data.batch[0]).toHaveLength(2);
      expect(data.batch[0][0].status).toBe(200);
      expect(data.batch[0][1].status).toBe(200);
      expect(data.summary.totalRequests).toBe(2);
    });

    it('interpolates values from previous round', async () => {
      const seq = nextFactorySequenceNumber();
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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(2);
      expect(data.batch[0][0].status).toBe(201);
      expect(data.batch[1][0].status).toBe(200);
      expect(data.batch[1][0].body.data.slug).toBe(`test-org-${seq}`);
    });

    it('resolves a reference the SDK percent-encoded into a path', async () => {
      const seq = nextFactorySequenceNumber();
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: { name: `Encoded Org ${seq}`, slug: `encoded-org-${seq}` },
              },
            ],
            [{ method: 'GET', path: '/api/v1/organization/%3C%3C0.0.body.data.id%3E%3E' }],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

      expect(data.batch[1][0].status).toBe(200);
      expect(data.batch[1][0].body.data.slug).toBe(`encoded-org-${seq}`);
    });

    it('sends escaped brackets in a body as literal text beside a live reference', async () => {
      const seq = nextFactorySequenceNumber();
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: { name: `Base ${seq}`, slug: `base-org-${seq}` },
              },
            ],
            [
              {
                method: 'POST',
                path: '/api/v1/organization',
                body: {
                  name: 'After <<0.0.body.data.slug>> \\<<kept\\>>',
                  slug: `escaped-org-${seq}`,
                },
              },
            ],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

      expect(data.batch[1][0].status).toBe(201);
      expect(data.batch[1][0].body.data.name).toBe(`After base-org-${seq} <<kept>>`);
    });

    it('treats 204 responses as successful empty results', async () => {
      const response = await (await memberlessUserFetch())(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'POST',
                path: '/api/v1/me/tokens',
                body: { name: `Delete Me ${Date.now()}`, role: 'owner' },
              },
            ],
            [{ method: 'DELETE', path: '/api/v1/token/<<0.0.body.data.id>>' }],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

      expect(response.status).toBe(200);
      expect(data.batch[0][0].status).toBe(201);
      expect(data.batch[1][0].status).toBe(204);
      expect(data.batch[1][0].error).toBeUndefined();
      expect(data.batch[1][0].body).toBeNull();
      expect(data.summary.failedRequests).toBe(0);
    });

    it('applies shared headers to all requests', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [[{ method: 'GET', path: '/api/v1/me' }]],
          headers: { 'X-Custom-Header': 'test-value' },
          strategy: 'allowFailures',
        }),
      );

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

      expect(response.status).toBe(200);
      expect(data.summary.status).toBe('partialSuccess');
      expect(data.summary.completedRounds).toBe(1);
      expect(data.batch).toHaveLength(2);
      expect(data.batch[1][0].error).toBeDefined();

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

      expect(response.status).toBe(200);
      expect(data.batch).toHaveLength(3);
      expect(data.batch[0][0].status).toBe(200);
      expect(data.batch[1][0].status).toBe(200);
      expect(data.batch[2][0].status).toBe(200);
    });

    it('reports failed (not partialSuccess) when round 0 fails with zero successes', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [
            [{ method: 'GET', path: '/api/v1/organization/invalid-id' }],
            [{ method: 'GET', path: '/api/v1/me' }],
          ],
          strategy: 'failOnRound',
        }),
      );

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);

      expect(response.status).toBe(200);
      expect(data.summary.status).toBe('failed');
      expect(data.summary.successfulRequests).toBe(0);
      expect(data.summary.failedRequests).toBe(1);
    });
  });

  describe('Security validations', () => {
    const refused = async (path: string) => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [[{ method: 'GET', path: '/api/v1/me' }], [{ method: 'POST', path }]],
          strategy: 'allowFailures',
        }),
      );
      return response.status;
    };

    it('rejects anonymous callers with 401', async () => {
      const anonymousFetch = createTestApp({ mount: routers }).fetch;
      const response = await anonymousFetch(
        post('/api/v1/batch/execute', {
          requests: [[{ method: 'GET', path: '/api/v1/me' }]],
          strategy: 'allowFailures',
        }),
      );

      expect(response.status).toBe(401);
    });

    it('refuses nested batch calls upfront', async () => {
      expect(await refused('/api/v1/batch/execute')).toBe(400);
    });

    it('strips authentication and spoof headers from sub-requests and sharedHeaders', async () => {
      let seenHeaders: Record<string, string | undefined> = {};
      const headerHarness = createTestApp({
        mockUser: user,
        mount: [
          ...routers,
          (app) =>
            app.get('/api/v1/probe-headers', (c) => {
              seenHeaders = {
                authorization: c.req.header('authorization'),
                cookie: c.req.header('cookie'),
                spoof: c.req.header('x-spoof-user-email'),
                forwarded: c.req.header('x-forwarded-for'),
                custom: c.req.header('x-custom-safe'),
              };
              return c.json({ data: { ok: true } });
            }),
        ],
      });

      const response = await headerHarness.fetch(
        post('/api/v1/batch/execute', {
          headers: {
            Authorization: 'Bearer stolen',
            Cookie: 'session=stolen',
            'X-Custom-Safe': 'kept',
          },
          requests: [
            [
              {
                method: 'GET',
                path: '/api/v1/probe-headers',
                headers: {
                  'X-Spoof-User-Email': 'victim@example.com',
                  'X-Forwarded-For': '127.0.0.1',
                },
              },
            ],
          ],
          strategy: 'allowFailures',
        }),
      );

      expect(response.status).toBe(200);
      expect(seenHeaders).toEqual({
        authorization: undefined,
        cookie: undefined,
        spoof: undefined,
        forwarded: undefined,
        custom: 'kept',
      });
    });

    it('refuses the whole batch when it calls Better Auth', async () => {
      expect(await refused('/api/auth/sign-in/email')).toBe(400);
      expect(await refused('/api/%61uth/sign-in/email')).toBe(400);
    });

    it('refuses the whole batch when it rotates JWTs', async () => {
      expect(await refused('/api/v1/me/rotateJwts')).toBe(400);
    });

    it('refuses an interpolated segment that could resolve to Better Auth', async () => {
      expect(await refused('/api/<<0.0.body.data.id>>/sign-in/email')).toBe(400);
    });

    it('re-checks a path after interpolation, so a resolved value cannot climb into an unbatchable route', async () => {
      const reference = '<<0.0.body.data.name>>';
      const secondRequestOf = async (name: string, path: string) => {
        const { entity } = await createUser({ name });
        const response = await createTestApp({ mockUser: entity, mount: routers }).fetch(
          post('/api/v1/batch/execute', {
            requests: [[{ method: 'GET', path: '/api/v1/me' }], [{ method: 'POST', path }]],
            strategy: 'allowFailures',
          }),
        );
        const { data } = await parseSuccessBody<BatchExecuteResponse>(response);
        const after = await db.user.findUniqueOrThrow({ where: { id: entity.id } });
        expect(after.jwtVersion).toBe(entity.jwtVersion);
        return data.batch[1][0];
      };
      for (const path of [
        `/api/v1/token/${reference}/me/rotateJwts`,
        `/api/v1/token/${reference}\\me\\rotateJwts`,
        `/api/v1/token/${reference}\t/me/rotateJwts`,
      ])
        expect((await secondRequestOf('..', path)).error).toContain("resolved to '..'");
      const climbed = await secondRequestOf('', `/api/v1/token/${reference}..\\me\\rotateJwts`);
      expect(climbed.error).toContain('cannot run in a batch');
    });

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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);
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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);
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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);
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

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);
      expect(response.status).toBe(200);
      expect(data.batch[1][0].status).toBe(500);
      expect(data.batch[1][0].error).toContain('Invalid round reference');
    });

    it('rejects interpolation that targets an empty 204 body', async () => {
      const response = await (await memberlessUserFetch())(
        post('/api/v1/batch/execute', {
          requests: [
            [
              {
                method: 'POST',
                path: '/api/v1/me/tokens',
                body: { name: `Empty Body Source ${Date.now()}`, role: 'owner' },
              },
            ],
            [{ method: 'DELETE', path: '/api/v1/token/<<0.0.body.data.id>>' }],
            [{ method: 'GET', path: '/api/v1/me/<<1.0.body.data.id>>' }],
          ],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);
      expect(response.status).toBe(200);
      expect(data.batch[1][0].status).toBe(204);
      expect(data.batch[2][0].status).toBe(500);
      expect(data.batch[2][0].error).toContain("field 'body.data.id' does not exist");
    });

    it('rejects absolute URLs', async () => {
      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [[{ method: 'GET', path: 'https://evil.com/api' }]],
          strategy: 'allowFailures',
        }),
      );

      const { data } = await parseSuccessBody<BatchExecuteResponse>(response);
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

      expect(response.status).toBe(422);
    });

    it('enforces maximum requests per round limit', async () => {
      const tooManyRequests = Array(51).fill({ method: 'GET', path: '/api/v1/me' });

      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [tooManyRequests],
          strategy: 'allowFailures',
        }),
      );
      const body = await parseErrorBody(response);

      expect(response.status).toBe(422);
      expect(body).toMatchObject({
        error: 'VALIDATION_ERROR',
        fieldErrors: { requests: ['Maximum 50 requests per round'] },
      });
    });

    it('enforces maximum total requests limit', async () => {
      const fullRound = Array(40).fill({ method: 'GET', path: '/api/v1/me' });

      const response = await fetch(
        post('/api/v1/batch/execute', {
          requests: [fullRound, fullRound, fullRound],
          strategy: 'allowFailures',
        }),
      );
      const body = await parseErrorBody(response);

      expect(response.status).toBe(422);
      expect(body).toMatchObject({
        error: 'VALIDATION_ERROR',
        fieldErrors: { requests: ['Maximum 100 total requests'] },
      });
    });
  });
});
