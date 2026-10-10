import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { CronJob, Organization, User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCronJob,
  createOrganization,
  createUser,
} from '@template/db/test';
import { adminRouter } from '#/routes/admin';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('adminRouter', () => {
  let memberFetch: ReturnType<typeof createTestApp>['fetch'];
  let superadminFetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let cronJob: CronJob;
  let deletedOrganization: Organization;

  beforeAll(async () => {
    const member: User = (await createUser()).entity;
    const superadmin: User = (await createUser({ platformRole: PlatformRole.superadmin })).entity;
    cronJob = (await createCronJob()).entity;

    const mount: MountFn = (app) => app.route('/api/admin', adminRouter);
    const memberHarness = createTestApp({ mockUser: member, mount: [mount] });
    memberFetch = memberHarness.fetch;
    db = memberHarness.db;
    superadminFetch = createTestApp({ mockUser: superadmin, mount: [mount] }).fetch;

    const { entity: organization } = await createOrganization();
    deletedOrganization = await db.organization.update({
      where: { id: organization.id },
      data: { deletedAt: new Date() },
    });
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('the superadmin check runs before the resource context', () => {
    it('refuses a non-superadmin before resolving an id that does not exist', async () => {
      const response = await memberFetch(get(`/api/admin/cronJob/${Bun.randomUUIDv7()}`));
      expect(response.status).toBe(403);
    });

    it('refuses a non-superadmin before validating the id', async () => {
      const response = await memberFetch(get('/api/admin/cronJob/not-a-uuid'));
      expect(response.status).toBe(403);
    });

    it('refuses a non-superadmin an id that does exist', async () => {
      const response = await memberFetch(get(`/api/admin/cronJob/${cronJob.id}`));
      expect(response.status).toBe(403);
    });

    it('resolves the resource for a superadmin', async () => {
      const response = await superadminFetch(get(`/api/admin/cronJob/${cronJob.id}`));
      expect(response.status).toBe(200);
      const { data } = await json<CronJob>(response);
      expect(data.id).toBe(cronJob.id);
    });

    it('answers 404 to a superadmin for an id that does not exist', async () => {
      const response = await superadminFetch(get(`/api/admin/cronJob/${Bun.randomUUIDv7()}`));
      expect(response.status).toBe(404);
    });
  });

  describe('the route decides tombstone visibility, not the scope', () => {
    const listed = async (deleted: string) => {
      const response = await superadminFetch(
        get(
          `/api/admin/organization?deleted=${deleted}&searchFields[id]=${deletedOrganization.id}`,
        ),
      );
      expect(response.status).toBe(200);
      const { data } = await json<Organization[]>(response);
      return data.map((organization) => organization.id);
    };

    it('lists a soft-deleted row when the route asks for deleted rows', async () => {
      expect(await listed('true')).toEqual([deletedOrganization.id]);
      expect(await listed('all')).toEqual([deletedOrganization.id]);
    });

    it('hides it when the route asks for live rows', async () => {
      expect(await listed('false')).toEqual([]);
    });
  });
});
