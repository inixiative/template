import '#tests/mocks/queue';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { AuditAction } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createCronJob, createInquiry, createToken, createUser } from '@template/db/test';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { auditActorContext, nullAuditActor } from '#/lib/auditActorContext';
import type { TokenWithRelations } from '#/lib/context/types';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { createTestApp } from '#tests/createTestApp';

registerAuditLogHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
});

describe('auditLog hook', () => {
  let userId: string;

  beforeAll(async () => {
    const { entity: user } = await createUser();
    userId = user.id;
  });

  it('creates an audit log entry on create', async () => {
    const ts = Date.now();
    const email = `audit-create-${ts}@example.com`;

    const { fetch } = createTestApp({
      mount: [
        (app) => {
          app.post('/test/user', async (c) => {
            const user = await db.user.create({ data: { email } });
            return c.json({ id: user.id });
          });
        },
      ],
    });

    const res = await fetch(new Request('http://localhost/test/user', { method: 'POST' }));
    const { id } = await res.json<{ id: string }>();

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: id, action: AuditAction.create },
      orderBy: { id: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.subjectModel).toBe('User');
    expect(log?.after).not.toBeNull();
    expect(log?.before).toBeNull();
    expect(log?.changes).toBeNull();
  });

  it('creates an audit log entry on update with correct diff', async () => {
    const { fetch } = createTestApp({
      mount: [
        (app) => {
          app.patch('/test/user/:id', async (c) => {
            await db.user.update({ where: { id: c.req.param('id') }, data: { name: 'Audit Test Name' } });
            return c.json({ ok: true });
          });
        },
      ],
    });

    await fetch(new Request(`http://localhost/test/user/${userId}`, { method: 'PATCH' }));

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

    const { fetch } = createTestApp({
      mount: [
        (app) => {
          app.patch('/test/user/:id/touch', async (c) => {
            await db.user.update({ where: { id: c.req.param('id') }, data: { updatedAt: new Date() } });
            return c.json({ ok: true });
          });
        },
      ],
    });

    await fetch(new Request(`http://localhost/test/user/${userId}/touch`, { method: 'PATCH' }));

    const after = await db.auditLog.count({ where: { subjectUserId: userId } });
    expect(after).toBe(before);
  });

  it('records actorUserId from authenticated request user', async () => {
    const { entity: actor } = await createUser();
    const ts = Date.now();

    const { fetch } = createTestApp({
      mockUser: actor,
      mount: [
        (app) => {
          app.use('*', auditActorMiddleware);
          app.post('/test/user', async (c) => {
            const user = await db.user.create({ data: { email: `audit-actor-${ts}@example.com` } });
            return c.json({ id: user.id });
          });
        },
      ],
    });

    const res = await fetch(new Request('http://localhost/test/user', { method: 'POST' }));
    const { id } = await res.json<{ id: string }>();

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: id, action: AuditAction.create },
      orderBy: { id: 'desc' },
    });

    expect(log?.actorUserId).toBe(actor.id);
    expect(log?.actorSpoofUserId).toBeNull();
    expect(log?.actorTokenId).toBeNull();
  });

  it('records actorSpoofUserId when spoofing', async () => {
    const { entity: actor } = await createUser();
    const { entity: spoofTarget } = await createUser();
    const ts = Date.now();

    const { fetch } = createTestApp({
      mockUser: actor,
      mount: [
        (app) => {
          app.use('*', async (c, next) => {
            c.set('spoofedBy', spoofTarget);
            return next();
          });
          app.use('*', auditActorMiddleware);
          app.post('/test/user', async (c) => {
            const user = await db.user.create({ data: { email: `audit-spoof-${ts}@example.com` } });
            return c.json({ id: user.id });
          });
        },
      ],
    });

    const res = await fetch(new Request('http://localhost/test/user', { method: 'POST' }));
    const { id } = await res.json<{ id: string }>();

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: id, action: AuditAction.create },
      orderBy: { id: 'desc' },
    });

    expect(log?.actorUserId).toBe(actor.id);
    expect(log?.actorSpoofUserId).toBe(spoofTarget.id);
  });

  it('records actorTokenId when authenticated via token', async () => {
    const { entity: tokenOwner } = await createUser();
    const { entity: token } = await createToken({ userId: tokenOwner.id });
    const ts = Date.now();

    const { fetch } = createTestApp({
      mockUser: tokenOwner,
      mockToken: token as unknown as TokenWithRelations,
      mount: [
        (app) => {
          app.use('*', auditActorMiddleware);
          app.post('/test/user', async (c) => {
            const user = await db.user.create({ data: { email: `audit-token-${ts}@example.com` } });
            return c.json({ id: user.id });
          });
        },
      ],
    });

    const res = await fetch(new Request('http://localhost/test/user', { method: 'POST' }));
    const { id } = await res.json<{ id: string }>();

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: id, action: AuditAction.create },
      orderBy: { id: 'desc' },
    });

    expect(log?.actorTokenId).toBe(token.id);
    expect(log?.actorUserId).toBe(tokenOwner.id);
  });

  it('records actorJobName when set in context', async () => {
    const ts = Date.now();
    let userId: string;

    await db.scope(
      'test-worker:test',
      () =>
        auditActorContext.scope({ ...nullAuditActor, actorJobName: 'cleanStaleAuditLogs' }, async () => {
          const user = await db.user.create({ data: { email: `audit-job-${ts}@example.com` } });
          userId = user.id;
        }),
      'worker',
    );

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: userId!, action: AuditAction.create },
      orderBy: { id: 'desc' },
    });

    expect(log?.actorJobName).toBe('cleanStaleAuditLogs');
  });

  it('records sourceInquiryId when set in context', async () => {
    const { entity: inquiry } = await createInquiry();
    const ts = Date.now();

    const { fetch } = createTestApp({
      mount: [
        (app) => {
          app.use('*', auditActorMiddleware);
          app.post('/test/resolve', async (c) => {
            auditActorContext.extend({ sourceInquiryId: inquiry.id });
            const user = await db.user.create({ data: { email: `audit-inquiry-${ts}@example.com` } });
            return c.json({ id: user.id });
          });
        },
      ],
    });

    const res = await fetch(new Request('http://localhost/test/resolve', { method: 'POST' }));
    const { id } = await res.json<{ id: string }>();

    const log = await db.auditLog.findFirst({
      where: { subjectUserId: id, action: AuditAction.create },
      orderBy: { id: 'desc' },
    });

    expect(log?.sourceInquiryId).toBe(inquiry.id);
  });

  it('creates a delete audit log on soft-delete (deletedAt transition)', async () => {
    // Hard-delete events cannot be audited via FK because the subject row is already
    // gone when the after hook fires. Use soft-delete (setting deletedAt) instead —
    // the org still exists so the FK constraint is satisfied.
    // (Hard-delete audit support requires scalar subject IDs — tracked in FEAT-017.)
    const ts = Date.now();

    const { fetch } = createTestApp({
      mount: [
        (app) => {
          app.post('/test/org', async (c) => {
            const org = await db.organization.create({ data: { name: `audit-softdel-${ts}`, slug: `softdel-${ts}` } });
            await db.organization.update({ where: { id: org.id }, data: { deletedAt: new Date() } });
            return c.json({ id: org.id });
          });
        },
      ],
    });

    const res = await fetch(new Request('http://localhost/test/org', { method: 'POST' }));
    const { id } = await res.json<{ id: string }>();

    const log = await db.auditLog.findFirst({
      where: { subjectOrganizationId: id, action: AuditAction.delete },
      orderBy: { id: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.action).toBe(AuditAction.delete);
    expect(log?.before).not.toBeNull();
    expect(log?.after).toBeNull();
  });

  it('does not write audit log for non-enabled models', async () => {
    const before = await db.auditLog.count();

    const { fetch } = createTestApp({
      mount: [
        (app) => {
          app.post('/test/cron', async (c) => {
            const { entity: cron } = await createCronJob();
            await db.cronJob.delete({ where: { id: cron.id } });
            return c.json({ ok: true });
          });
        },
      ],
    });

    await fetch(new Request('http://localhost/test/cron', { method: 'POST' }));

    const after = await db.auditLog.count();
    expect(after).toBe(before);
  });
});
