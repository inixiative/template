import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createCronJob, createUser } from '@template/db/test';
import { registerCronJobSyncHook } from '#/hooks/cronJobSync/hook';
import { adminCronJobRouter } from '#/modules/admin/cronJob';
import { createTestApp } from '#tests/createTestApp';
import { connectRealJobsQueue } from '#tests/utils/realJobsQueue';
import { del, patch, post } from '#tests/utils/request';

const handler = 'sweepSegments';
const patterns = ['17 3 * * *', '19 5 * * *'] as const;

let jobs: Awaited<ReturnType<typeof connectRealJobsQueue>>;
let fetch: ReturnType<typeof createTestApp>['fetch'];

const newJobId = () => `scheduler-test-${crypto.randomUUID()}`;

const createBody = (jobId: string, overrides: Record<string, unknown> = {}) => ({
  name: jobId,
  jobId,
  description: null,
  pattern: patterns[0],
  handler,
  payload: null,
  enabled: true,
  maxAttempts: 3,
  backoffMs: 5000,
  createdById: null,
  ...overrides,
});

const createScheduledCronJob = async () => {
  const { entity } = await createCronJob({
    jobId: newJobId(),
    handler,
    pattern: patterns[0],
  });
  return entity;
};

beforeAll(async () => {
  registerCronJobSyncHook();
  jobs = await connectRealJobsQueue();
  const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
  ({ fetch } = createTestApp({
    mockUser: superadmin as User,
    mount: [(app) => app.route('/api/admin/cronJob', adminCronJobRouter)],
  }));
});

afterEach(async () => {
  await jobs.realQueue.obliterate({ force: true });
});

afterAll(async () => {
  clearHookRegistry();
  await jobs.close();
  await cleanupTouchedTables(db);
});

describe('admin cron writes keep the job scheduler in step with the row', () => {
  it('creates the scheduler keyed by jobId, moves it on edits and removes it on disable', async () => {
    const jobId = newJobId();
    expect((await fetch(post('/api/admin/cronJob', createBody(jobId)))).status).toBe(201);
    const { id } = await db.cronJob.findUniqueOrThrow({ where: { jobId } });
    expect(await jobs.schedulerOf(jobId)).toEqual({ name: handler, pattern: patterns[0] });

    expect((await fetch(patch(`/api/admin/cronJob/${id}`, { pattern: patterns[1] }))).status).toBe(
      200,
    );
    expect(await jobs.schedulerOf(jobId)).toEqual({ name: handler, pattern: patterns[1] });

    expect((await fetch(patch(`/api/admin/cronJob/${id}`, { enabled: false }))).status).toBe(200);
    expect(await jobs.schedulerOf(jobId)).toBeNull();

    expect((await fetch(patch(`/api/admin/cronJob/${id}`, { enabled: true }))).status).toBe(200);
    expect(await jobs.schedulerOf(jobId)).toEqual({ name: handler, pattern: patterns[1] });
    const delayed = (await jobs.realQueue.getDelayed()).filter((job) => job.repeatJobKey === jobId);
    expect(delayed).toHaveLength(1);
  });

  it('moves the scheduler when the jobId changes', async () => {
    const cronJob = await createScheduledCronJob();
    const renamed = newJobId();

    expect(
      (await fetch(patch(`/api/admin/cronJob/${cronJob.id}`, { jobId: renamed }))).status,
    ).toBe(200);

    expect(await jobs.schedulerOf(cronJob.jobId)).toBeNull();
    expect(await jobs.schedulerOf(renamed)).toEqual({ name: handler, pattern: patterns[0] });
  });

  it('creates a disabled row without a scheduler', async () => {
    const jobId = newJobId();

    const response = await fetch(post('/api/admin/cronJob', createBody(jobId, { enabled: false })));

    expect(response.status).toBe(201);
    expect(await jobs.schedulerOf(jobId)).toBeNull();
  });

  it('removes the scheduler on delete', async () => {
    const cronJob = await createScheduledCronJob();

    expect((await fetch(del(`/api/admin/cronJob/${cronJob.id}`))).status).toBe(204);

    expect(await jobs.schedulerOf(cronJob.jobId)).toBeNull();
    expect(await db.cronJob.findUnique({ where: { id: cronJob.id } })).toBeNull();
  });
});

describe('admin cron writes refuse what BullMQ cannot schedule', () => {
  it.each([
    ['an out-of-range pattern', { pattern: '61 * * * *' }],
    ['an impossible date', { pattern: '0 0 31 2 *' }],
    ['an unknown handler', { handler: 'renamedHandler' }],
  ])('rejects a create with %s and writes nothing', async (_, invalid) => {
    const jobId = newJobId();

    const response = await fetch(post('/api/admin/cronJob', createBody(jobId, invalid)));

    expect(response.status).toBe(422);
    expect(await db.cronJob.findUnique({ where: { jobId } })).toBeNull();
    expect(await jobs.schedulerOf(jobId)).toBeNull();
  });

  it.each([
    ['an out-of-range pattern', { pattern: '61 * * * *' }],
    ['an unknown handler', { handler: 'renamedHandler' }],
  ])('rejects an update with %s and keeps the row and its scheduler', async (_, invalid) => {
    const cronJob = await createScheduledCronJob();

    const response = await fetch(patch(`/api/admin/cronJob/${cronJob.id}`, invalid));

    expect(response.status).toBe(422);
    const row = await db.cronJob.findUniqueOrThrow({ where: { id: cronJob.id } });
    expect({ handler: row.handler, pattern: row.pattern }).toEqual({
      handler,
      pattern: patterns[0],
    });
    expect(await jobs.schedulerOf(cronJob.jobId)).toEqual({ name: handler, pattern: patterns[0] });
  });

  it('rejects a create whose jobId BullMQ would read as a legacy repeatable key', async () => {
    const jobId = `bad:${newJobId()}`;

    const response = await fetch(post('/api/admin/cronJob', createBody(jobId)));

    expect(response.status).toBe(422);
    expect(await db.cronJob.findUnique({ where: { jobId } })).toBeNull();
  });

  it('always lets a broken row be turned off', async () => {
    const cronJob = await createScheduledCronJob();
    await db.raw.cronJob.update({ where: { id: cronJob.id }, data: { handler: 'renamedHandler' } });

    expect(
      (await fetch(patch(`/api/admin/cronJob/${cronJob.id}`, { enabled: false }))).status,
    ).toBe(200);

    expect(await jobs.schedulerOf(cronJob.jobId)).toBeNull();
  });
});

describe('a failed scheduler sync is repaired by sending the same request again', () => {
  it('update', async () => {
    const cronJob = await createScheduledCronJob();
    jobs.upsertJobScheduler.mockImplementationOnce(() =>
      Promise.reject(new Error('Redis unavailable')),
    );

    expect(
      (await fetch(patch(`/api/admin/cronJob/${cronJob.id}`, { pattern: patterns[1] }))).status,
    ).toBe(500);
    expect(await jobs.schedulerOf(cronJob.jobId)).toEqual({ name: handler, pattern: patterns[0] });

    expect(
      (await fetch(patch(`/api/admin/cronJob/${cronJob.id}`, { pattern: patterns[1] }))).status,
    ).toBe(200);
    expect(await jobs.schedulerOf(cronJob.jobId)).toEqual({ name: handler, pattern: patterns[1] });
  });

  it('create', async () => {
    const jobId = newJobId();
    jobs.upsertJobScheduler.mockImplementationOnce(() =>
      Promise.reject(new Error('Redis unavailable')),
    );

    expect((await fetch(post('/api/admin/cronJob', createBody(jobId)))).status).toBe(500);
    expect(await jobs.schedulerOf(jobId)).toBeNull();

    expect((await fetch(post('/api/admin/cronJob', createBody(jobId)))).status).toBe(201);
    expect(await jobs.schedulerOf(jobId)).toEqual({ name: handler, pattern: patterns[0] });
    expect(await db.cronJob.count({ where: { jobId } })).toBe(1);
  });

  it('delete', async () => {
    const cronJob = await createScheduledCronJob();
    jobs.removeJobScheduler.mockImplementationOnce(() =>
      Promise.reject(new Error('Redis unavailable')),
    );

    expect((await fetch(del(`/api/admin/cronJob/${cronJob.id}`))).status).toBe(500);
    expect(await db.cronJob.findUnique({ where: { id: cronJob.id } })).not.toBeNull();

    expect((await fetch(del(`/api/admin/cronJob/${cronJob.id}`))).status).toBe(204);
    expect(await jobs.schedulerOf(cronJob.jobId)).toBeNull();
    expect(await db.cronJob.findUnique({ where: { id: cronJob.id } })).toBeNull();
  });
});
