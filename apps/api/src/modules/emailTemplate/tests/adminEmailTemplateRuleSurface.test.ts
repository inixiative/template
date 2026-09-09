import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createEmailTemplate, createUser } from '@template/db/test';
import { adminEmailTemplateRouter } from '#/modules/emailTemplate';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

type Surface = {
  source: { model: string; mapName: string; maps: Record<string, { models: Record<string, { fields: Record<string, unknown> }> }> };
  decoration: { facets: { path: string; label: string }[] };
};

const fieldsOf = (surface: Surface, model: string): string[] =>
  Object.keys(surface.source.maps[surface.source.mapName]?.models[model]?.fields ?? {}).sort();

describe('POST /api/admin/emailTemplate/ruleSurface', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let superadmin: User;

  beforeAll(async () => {
    superadmin = (await createUser({ platformRole: PlatformRole.superadmin })).entity;
    const harness = createTestApp({
      mockUser: superadmin,
      mount: [(app) => app.route('/api/admin/emailTemplate', adminEmailTemplateRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('serves the registry projection narrowed by the default-tier row lens', async () => {
    await createEmailTemplate({
      slug: 'welcome',
      ownerModel: 'default',
      locale: 'en',
      lens: {
        recipient: { picks: ['email'], relations: { organizationUsers: { picks: ['role'] } } },
        data: { picks: ['name'] },
      },
    });

    const { data } = await json<Surface>(await fetch(post('/api/admin/emailTemplate/ruleSurface', { slug: 'welcome' })));

    expect(data.source.model).toBe('EmailRuleContext');
    expect(fieldsOf(data, 'EmailRuleContext')).toEqual(['data', 'recipient']);
    expect(fieldsOf(data, 'User')).toEqual(['email', 'name', 'organizationUsers']);
    expect(fieldsOf(data, 'OrganizationUser')).toEqual(['role']);
    expect(data.decoration.facets.map((f) => f.path)).toEqual(['recipient', 'data']);
  });

  it('falls back to the engine default lens when no default-tier row declares one', async () => {
    const { data } = await json<Surface>(
      await fetch(post('/api/admin/emailTemplate/ruleSurface', { slug: 'inquiry-invite-organization-user' })),
    );

    expect(fieldsOf(data, 'EmailRuleContext')).toEqual(['data', 'recipient', 'sender']);
    expect(fieldsOf(data, 'User')).toEqual(['email', 'id', 'name']);
    expect(fieldsOf(data, 'Inquiry')).toContain('content');
    expect(fieldsOf(data, 'Organization')).toContain('name');
  });

  it('serves a recipient-only projection for a slug the registry does not know', async () => {
    const { data } = await json<Surface>(await fetch(post('/api/admin/emailTemplate/ruleSurface', { slug: 'adhoc' })));

    expect(fieldsOf(data, 'EmailRuleContext')).toEqual(['recipient']);
    expect(data.decoration.facets).toEqual([{ path: 'recipient', label: 'Recipient' }]);
  });
});
