import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { AuditAction } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { auditActorContext } from '#/lib/auditActorContext';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';

registerAuditLogHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
});

const testActor = {
  actorUserId: null,
  actorSpoofUserId: null,
  actorTokenId: null,
  actorJobName: null,
  ipAddress: '127.0.0.1',
  userAgent: 'test',
  sourceInquiryId: null,
};

describe('auditLog hook', () => {
  let userId: string;

  beforeAll(async () => {
    const { entity: user } = await createUser();
    userId = user.id;
  });

  it('creates an audit log entry on create', async () => {
    const user = await auditActorContext.run(testActor, () =>
      db.user.create({ data: { email: `audit-create-${Date.now()}@example.com` } }),
    );

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: user.id, action: AuditAction.create },
      orderBy: { id: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.subjectModel).toBe('User');
    expect(log?.after).not.toBeNull();
    expect(log?.before).toBeNull();
    expect(log?.changes).toBeNull();
  });

  it('creates an audit log entry on update with correct diff', async () => {
    await auditActorContext.run(testActor, () =>
      db.user.update({ where: { id: userId }, data: { name: 'Audit Test Name' } }),
    );

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: userId, action: AuditAction.update },
      orderBy: { id: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.changes).toMatchObject({ name: { after: 'Audit Test Name' } });
    expect(log?.before).not.toBeNull();
    expect(log?.after).not.toBeNull();
  });

  it('skips audit log on noop update (ignored fields only)', async () => {
    const before = await db.auditLog.count({ where: { subjectUserId: userId } });

    await auditActorContext.run(testActor, () =>
      db.user.update({ where: { id: userId }, data: { updatedAt: new Date() } }),
    );

    const after = await db.auditLog.count({ where: { subjectUserId: userId } });
    expect(after).toBe(before);
  });

  it('records actorJobName when set in context', async () => {
    const jobActor = { ...testActor, actorJobName: 'cleanStaleAuditLogs' };

    const user = await auditActorContext.run(jobActor, () =>
      db.user.create({ data: { email: `audit-job-${Date.now()}@example.com` } }),
    );

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: user.id, action: AuditAction.create },
      orderBy: { id: 'desc' },
    });

    expect(log?.actorJobName).toBe('cleanStaleAuditLogs');
  });

  it('records sourceInquiryId when set in context', async () => {
    const inquiryActor = { ...testActor, sourceInquiryId: 'inq-test-id' };

    const user = await auditActorContext.run(inquiryActor, () =>
      db.user.create({ data: { email: `audit-inquiry-${Date.now()}@example.com` } }),
    );

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: user.id, action: AuditAction.create },
      orderBy: { id: 'desc' },
    });

    expect(log?.sourceInquiryId).toBe('inq-test-id');
  });

  it('creates an audit log entry on delete', async () => {
    const user = await auditActorContext.run(testActor, () =>
      db.user.create({ data: { email: `audit-delete-${Date.now()}@example.com` } }),
    );

    await auditActorContext.run(testActor, () =>
      db.user.delete({ where: { id: user.id } }),
    );

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: user.id, action: AuditAction.delete },
      orderBy: { id: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.before).not.toBeNull();
    expect(log?.after).toBeNull();
  });
});
