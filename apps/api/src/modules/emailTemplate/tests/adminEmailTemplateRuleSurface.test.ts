import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createEmailTemplate, createOrganization, createSegment, createTag, createUser } from '@template/db/test';
import { adminEmailTemplateRouter } from '#/modules/emailTemplate';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

type Surface = {
  source: {
    model: string;
    mapName: string;
    maps: Record<string, { models: Record<string, { fields: Record<string, unknown> }> }>;
  };
  decoration: { facets: { path: string; label: string }[] };
  sourceValues: { model: string; field: string; options: { value: unknown; label?: string }[] }[];
};

const optionsOf = (surface: Surface, model: string): unknown[] =>
  surface.sourceValues.filter((source) => source.model === model).flatMap((source) => source.options.map((o) => o.value));

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
        data: { narrowing: { picks: ['name'] } },
      },
    });

    const { data } = await json<Surface>(
      await fetch(post('/api/admin/emailTemplate/ruleSurface', { slug: 'welcome' })),
    );

    expect(data.source.model).toBe('Email');
    expect(fieldsOf(data, 'Email')).toEqual(['data', 'recipient', 'system']);
    expect(fieldsOf(data, 'User')).toEqual(['email', 'name', 'organizationUsers']);
    expect(fieldsOf(data, 'OrganizationUser')).toEqual(['role']);
    expect(data.decoration.facets.map((f) => f.path)).toEqual(['recipient', 'data', 'system']);
  });

  it('lets the row choose the data entry point and relations from the projection', async () => {
    await createEmailTemplate({
      slug: 'adhoc-with-entry',
      ownerModel: 'default',
      locale: 'en',
      lens: {
        data: {
          model: 'Inquiry',
          narrowing: { picks: ['content'], relations: { sourceOrganization: { picks: ['name'] } } },
        },
      },
    });

    const { data } = await json<Surface>(
      await fetch(post('/api/admin/emailTemplate/ruleSurface', { slug: 'adhoc-with-entry' })),
    );

    expect(data.source.maps[data.source.mapName]?.models.Email?.fields.data).toMatchObject({
      kind: 'object',
      type: 'Inquiry',
    });
    expect(fieldsOf(data, 'Inquiry')).toEqual(['content', 'sourceOrganization']);
    expect(fieldsOf(data, 'Organization')).toEqual(['id', 'name']);
  });

  it('falls back to the engine default lens when no default-tier row declares one', async () => {
    const { data } = await json<Surface>(
      await fetch(post('/api/admin/emailTemplate/ruleSurface', { slug: 'inquiry-invite-organization-user' })),
    );

    expect(fieldsOf(data, 'Email')).toEqual(['data', 'recipient', 'sender', 'system']);
    expect(fieldsOf(data, 'User')).toEqual([
      'email',
      'id',
      'name',
      'organizationUsers',
      'providerRefs',
      'spaceUsers',
      'tagAttachments',
    ]);
    expect(fieldsOf(data, 'Inquiry')).toContain('content');
    expect(fieldsOf(data, 'Organization')).toContain('name');
  });

  it('serves a recipient plus an unknown data bag for a slug the registry does not know', async () => {
    const { data } = await json<Surface>(await fetch(post('/api/admin/emailTemplate/ruleSurface', { slug: 'adhoc' })));

    expect(fieldsOf(data, 'Email')).toEqual(['data', 'recipient', 'system']);
    expect(data.source.maps[data.source.mapName]?.models.Email?.fields.data).toEqual({
      kind: 'scalar',
      type: 'Json',
    });
    expect(data.decoration.facets).toEqual([
      { path: 'recipient', label: 'Recipient' },
      { path: 'data', label: 'Data' },
      { path: 'system', label: 'System' },
    ]);
  });
});

describe('POST /api/admin/emailTemplate/ruleSurface — the picker offers what the owner can see', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];

  beforeAll(async () => {
    const superadmin = (await createUser({ platformRole: PlatformRole.superadmin })).entity;
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

  it('platform tags plus the owner\'s tags and segments, never another owner\'s', async () => {
    const { entity: mine } = await createOrganization();
    const { entity: theirs } = await createOrganization();
    const platformTag = (await createTag()).entity;
    const myTag = (await createTag({ ownerModel: 'Organization' }, { organization: mine })).entity;
    const theirTag = (await createTag({ ownerModel: 'Organization' }, { organization: theirs })).entity;
    const mySegment = (await createSegment({ ownerModel: 'Organization' }, { organization: mine })).entity;
    const theirSegment = (await createSegment({ ownerModel: 'Organization' }, { organization: theirs })).entity;

    const { data } = await json<Surface>(
      await fetch(
        post('/api/admin/emailTemplate/ruleSurface', {
          slug: 'welcome',
          ownerModel: 'Organization',
          organizationId: mine.id,
        }),
      ),
    );

    const tags = optionsOf(data, 'Tag');
    expect(tags).toContain(platformTag.id);
    expect(tags).toContain(myTag.id);
    expect(tags).not.toContain(theirTag.id);
    const segments = optionsOf(data, 'Segment');
    expect(segments).toContain(mySegment.id);
    expect(segments).not.toContain(theirSegment.id);
  });

  it('a platform template offers platform tags and no segments', async () => {
    const { entity: org } = await createOrganization();
    const platformTag = (await createTag()).entity;
    const orgTag = (await createTag({ ownerModel: 'Organization' }, { organization: org })).entity;
    await createSegment({ ownerModel: 'Organization' }, { organization: org });

    const { data } = await json<Surface>(await fetch(post('/api/admin/emailTemplate/ruleSurface', { slug: 'welcome' })));

    const tags = optionsOf(data, 'Tag');
    expect(tags).toContain(platformTag.id);
    expect(tags).not.toContain(orgTag.id);
    expect(optionsOf(data, 'Segment')).toEqual([]);
  });
});
