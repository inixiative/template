import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { AuditAction } from '@template/db/generated/client/enums';
import { auditActorContext, auditActorStore, nullAuditActor } from '@template/db/lib/auditActorContext';
import {
  cleanupTouchedTables,
  createCronJob,
  createInquiry,
  createOrganization,
  createSpace,
  createToken,
  createUser,
} from '@template/db/test';
import { registerTestTracker } from '@template/db/test/testTracker';
import { saveEmailTemplate } from '@template/email/render';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import type { TokenWithRelations } from '#/lib/context/types';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { createTestApp } from '#tests/createTestApp';

registerTestTracker();
registerAuditLogHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
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
    const mockToken: TokenWithRelations = {
      ...token,
      user: tokenOwner,
      organization: null,
      organizationUser: null,
      space: null,
      spaceUser: null,
    };
    const ts = Date.now();

    const { fetch } = createTestApp({
      mockUser: tokenOwner,
      mockToken,
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
    const { entity: organization } = await createOrganization();
    const { entity: targetUser } = await createUser();
    const { entity: inquiry } = await createInquiry({
      sourceOrganizationId: organization.id,
      targetUserId: targetUser.id,
    });
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

  it('creates a delete audit log on hard-delete and preserves the deleted row in before', async () => {
    const ts = Date.now();
    const slug = `harddel-${ts}`;

    const { fetch } = createTestApp({
      mount: [
        (app) => {
          app.post('/test/org/hard-delete', async (c) => {
            const org = await db.organization.create({ data: { name: `audit-harddel-${ts}`, slug } });
            await db.organization.delete({ where: { id: org.id } });
            return c.json({ id: org.id });
          });
        },
      ],
    });

    const res = await fetch(new Request('http://localhost/test/org/hard-delete', { method: 'POST' }));
    const { id } = await res.json<{ id: string }>();

    const logs = await db.auditLog.findMany({
      where: { subjectModel: 'Organization', action: AuditAction.delete },
      orderBy: { id: 'desc' },
      take: 10,
    });

    const log = logs.find((entry) => {
      const before = entry.before as { id?: string; slug?: string } | null;
      return before?.id === id && before.slug === slug;
    });

    expect(log).toBeDefined();
    expect(log?.subjectOrganizationId).toBeNull();
    expect(log?.contextOrganizationId).toBeNull();
    expect(log?.action).toBe(AuditAction.delete);
    expect(log?.after).toBeNull();
  });

  it('keeps org context but clears space context on hard-delete for spaces', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });

    const { fetch } = createTestApp({
      mount: [
        (app) => {
          app.post('/test/space/hard-delete', async (c) => {
            await db.space.delete({ where: { id: space.id } });
            return c.json({ ok: true });
          });
        },
      ],
    });

    const res = await fetch(new Request('http://localhost/test/space/hard-delete', { method: 'POST' }));
    expect(res.status).toBe(200);

    const logs = await db.auditLog.findMany({
      where: { subjectModel: 'Space', action: AuditAction.delete, contextOrganizationId: organization.id },
      orderBy: { id: 'desc' },
      take: 10,
    });

    const log = logs.find((entry) => {
      const before = entry.before as { id?: string } | null;
      return before?.id === space.id;
    });

    expect(log).toBeDefined();
    expect(log?.subjectSpaceId).toBeNull();
    expect(log?.contextOrganizationId).toBe(organization.id);
    expect(log?.contextSpaceId).toBeNull();
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

  // saveEmailTemplate is the deterministic case in this repo where async-local storage does not
  // survive into the mutation extension's continuation, so it is what pins the actor across that
  // hop: before the bridge the hook read a null actor here and attributed every row to nobody.
  describe('actor attribution across a frame that loses async-local storage', () => {
    const emailTemplate = (slug: string) => ({
      slug,
      name: slug,
      subject: 'Hi',
      kind: 'system' as const,
      mjml: `<mjml><mj-body><mj-section><mj-column>{{#component:${slug}-greeting}}<mj-text>Hello</mj-text>{{/component:${slug}-greeting}}</mj-column></mj-section></mj-body></mjml>`,
      ownerModel: 'default' as const,
    });

    const auditRowsFor = (templateId: string, componentId: string) =>
      db.auditLog.findMany({
        where: { OR: [{ subjectEmailTemplateId: templateId }, { subjectEmailComponentId: componentId }] },
      });

    it('records the actor set at the caller on every row the save writes', async () => {
      const { template, components } = await auditActorContext.scope(
        { ...nullAuditActor, actorJobName: 'bridgedActor' },
        () => saveEmailTemplate(emailTemplate(`actor-bridged-${Date.now()}`)),
      );

      const logs = await auditRowsFor(template.id, components[0]!.id);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((log) => log.actorJobName === 'bridgedActor')).toBe(true);
    });

    it('leaves the actor null when the caller set none', async () => {
      const { template, components } = await saveEmailTemplate(emailTemplate(`actor-absent-${Date.now()}`));

      const logs = await auditRowsFor(template.id, components[0]!.id);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((log) => log.actorJobName === null)).toBe(true);
    });

    const actorLogFor = (userId: string) =>
      db.auditLog.findFirst({ where: { subjectUserId: userId, action: AuditAction.create } });

    it('records the actor for an unwrapped write — the txn opens in the caller frame', async () => {
      let userId = '';
      await auditActorContext.scope({ ...nullAuditActor, actorJobName: 'reissuedActor' }, async () => {
        const user = await db.user.create({ data: { email: `actor-reissue-${Date.now()}@example.com` } });
        userId = user.id;
      });

      expect((await actorLogFor(userId))?.actorJobName).toBe('reissuedActor');
    });

    it('records the actor when the scope callback returns the write un-awaited', async () => {
      const user = await auditActorContext.scope({ ...nullAuditActor, actorJobName: 'lazyActor' }, () =>
        db.user.create({ data: { email: `actor-lazy-${Date.now()}@example.com` } }),
      );

      expect((await actorLogFor(user.id))?.actorJobName).toBe('lazyActor');
    });

    it('leaves the actor null for an unwrapped write when nothing is alive at the call site', async () => {
      let userId = '';
      await auditActorContext.scope({ ...nullAuditActor, actorJobName: 'lostActor' }, () =>
        auditActorStore.exit(async () => {
          const user = await db.user.create({ data: { email: `actor-lost-${Date.now()}@example.com` } });
          userId = user.id;
        }),
      );

      expect((await actorLogFor(userId))?.actorJobName).toBeNull();
    });

    it('keeps the actor across the same severed frame when the caller wraps in db.txn', async () => {
      let userId = '';
      await auditActorContext.scope({ ...nullAuditActor, actorJobName: 'rescuedActor' }, () =>
        db.txn(() =>
          auditActorStore.exit(async () => {
            const user = await db.user.create({ data: { email: `actor-rescued-${Date.now()}@example.com` } });
            userId = user.id;
          }),
        ),
      );

      expect((await actorLogFor(userId))?.actorJobName).toBe('rescuedActor');
    });

    it('runs a db.raw write with no life cycle at all — no transaction, no hooks, no audit row', async () => {
      const user = await db.raw.user.create({ data: { email: `actor-raw-${Date.now()}@example.com` } });

      expect(await actorLogFor(user.id)).toBeNull();
    });
  });
});
