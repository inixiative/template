import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { cleanupTouchedTables } from '@template/db/test';
import { recordAppEvent } from '#/jobs/handlers/recordAppEvent';
import type { WorkerContext } from '#/jobs/types';
import { createTestApp } from '#tests/createTestApp';

describe('recordAppEvent handler', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  const mockLog = () => {};

  beforeAll(() => {
    const harness = createTestApp();
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const ctx = () => ({ db, log: mockLog }) as WorkerContext;

  const nullActor = {
    actorUserId: null,
    actorSpoofUserId: null,
    actorTokenId: null,
    actorJobName: null,
    ipAddress: null,
    userAgent: null,
    sourceInquiryId: null,
  };

  it('persists event with full actor and resource fields', async () => {
    await recordAppEvent(ctx(), {
      name: 'test.event',
      actor: {
        actorUserId: 'user-123',
        actorSpoofUserId: 'spoof-456',
        actorTokenId: 'token-789',
        actorJobName: 'job-name',
        ipAddress: '10.0.0.1',
        userAgent: 'agent',
        sourceInquiryId: 'inquiry-1',
      },
      resourceType: 'Inquiry',
      resourceId: 'res-1',
      data: { foo: 'bar' },
    });

    const row = await db.appEvent.findFirst({
      where: { name: 'test.event', resourceId: 'res-1' },
      orderBy: { createdAt: 'desc' },
    });

    expect(row).not.toBeNull();
    expect(row?.actorUserId).toBe('user-123');
    expect(row?.actorSpoofUserId).toBe('spoof-456');
    expect(row?.actorTokenId).toBe('token-789');
    expect(row?.actorJobName).toBe('job-name');
    expect(row?.ipAddress).toBe('10.0.0.1');
    expect(row?.userAgent).toBe('agent');
    expect(row?.sourceInquiryId).toBe('inquiry-1');
    expect(row?.resourceType).toBe('Inquiry');
    expect(row?.data).toEqual({ foo: 'bar' });
  });

  it('persists event with null actor fields and no resource', async () => {
    await recordAppEvent(ctx(), {
      name: 'test.minimal',
      actor: nullActor,
      data: {},
    });

    const row = await db.appEvent.findFirst({
      where: { name: 'test.minimal' },
      orderBy: { createdAt: 'desc' },
    });

    expect(row).not.toBeNull();
    expect(row?.actorUserId).toBeNull();
    expect(row?.resourceType).toBeNull();
    expect(row?.resourceId).toBeNull();
    expect(row?.data).toEqual({});
  });
});
