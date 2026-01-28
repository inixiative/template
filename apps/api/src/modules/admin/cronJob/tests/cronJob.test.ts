import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type CronJob, PlatformRole, type User } from '@template/db';
import { cleanupTouchedTables, createCronJob, createUser, getNextSeq } from '@template/db/test';
import { adminCronJobRouter } from '#/modules/admin/cronJob';
import { createTestApp } from '#tests/createTestApp';
import { del, get, json, jsonError, patch, post } from '#tests/utils/request';

describe('admin/cronJob', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let superadmin: User;

  beforeAll(async () => {
    const { entity: admin } = await createUser({ platformRole: PlatformRole.superadmin });
    superadmin = admin;

    const harness = createTestApp({
      mockUser: superadmin,
      mount: [(app) => app.route('/api/admin/cronJob', adminCronJobRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('GET /api/admin/cronJob', () => {
    it('returns all cron jobs', async () => {
      const name = `list-test-${getNextSeq()}`;
      await createCronJob({ name });

      const response = await fetch(get('/api/admin/cronJob'));
      const { data } = await json<CronJob[]>(response);
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((j) => j.name === name)).toBe(true);
    });
  });

  describe('POST /api/admin/cronJob', () => {
    it('creates a cron job', async () => {
      const seq = getNextSeq();
      const response = await fetch(
        post('/api/admin/cronJob', {
          name: `new-cron-${seq}`,
          jobId: `new-job-${seq}`,
          description: null,
          pattern: '*/5 * * * *',
          handler: 'sendWebhook',
          payload: null,
          enabled: true,
          maxAttempts: 3,
          backoffMs: 5000,
          createdById: null,
        }),
      );
      const { data } = await json<CronJob>(response);
      expect(response.status).toBe(201);
      expect(data.name).toBe(`new-cron-${seq}`);
      expect(data.pattern).toBe('*/5 * * * *');
    });

    it('rejects duplicate name', async () => {
      const name = `duplicate-${getNextSeq()}`;
      await createCronJob({ name });

      const response = await fetch(
        post('/api/admin/cronJob', {
          name,
          jobId: `dup-job-${getNextSeq()}`,
          description: null,
          pattern: '0 * * * *',
          handler: 'sendWebhook',
          payload: null,
          enabled: true,
          maxAttempts: 3,
          backoffMs: 5000,
          createdById: null,
        }),
      );
      await jsonError(response);
      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/admin/cronJob/:id', () => {
    it('returns a cron job by id', async () => {
      const name = `read-test-${getNextSeq()}`;
      const { entity: cronJob } = await createCronJob({ name });

      const response = await fetch(get(`/api/admin/cronJob/${cronJob.id}`));
      const { data } = await json<CronJob>(response);
      expect(response.status).toBe(200);
      expect(data.id).toBe(cronJob.id);
      expect(data.name).toBe(name);
    });
  });

  describe('PATCH /api/admin/cronJob/:id', () => {
    it('updates a cron job', async () => {
      const { entity: cronJob } = await createCronJob({ name: `update-test-${getNextSeq()}`, enabled: true });

      const response = await fetch(
        patch(`/api/admin/cronJob/${cronJob.id}`, {
          enabled: false,
          description: 'Updated description',
        }),
      );
      const { data } = await json<CronJob>(response);
      expect(response.status).toBe(200);
      expect(data.enabled).toBe(false);
      expect(data.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/admin/cronJob/:id', () => {
    it('deletes a cron job', async () => {
      const { entity: cronJob } = await createCronJob({ name: `delete-test-${getNextSeq()}` });

      const response = await fetch(del(`/api/admin/cronJob/${cronJob.id}`));
      expect(response.status).toBe(204);

      const deleted = await db.cronJob.findUnique({ where: { id: cronJob.id } });
      expect(deleted).toBeNull();
    });
  });

  describe('POST /api/admin/cronJob/:id/trigger', () => {
    it('triggers a cron job', async () => {
      const { entity: cronJob } = await createCronJob({ name: `trigger-test-${getNextSeq()}` });

      const response = await fetch(post(`/api/admin/cronJob/${cronJob.id}/trigger`, {}));
      expect(response.status).toBe(204);
    });
  });
});
