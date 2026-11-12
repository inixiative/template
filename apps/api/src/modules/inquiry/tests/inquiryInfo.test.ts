import { describe, expect, it } from 'bun:test';
import { type InquiryType, Role } from '@template/db/generated/client/enums';
import { INQUIRY_TYPES } from '@template/permissions';
import { inquiryRouter } from '#/modules/inquiry';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

type InquiryTypeInfo = {
  sources: string[];
  targets: string[];
  unique: string | null;
  defaultExpirationDays: number | null;
  content: { properties?: Record<string, { enum?: string[] }>; required?: string[] };
  resolutionInput: { properties?: Record<string, unknown> };
  resolution: { properties?: Record<string, unknown> };
};

const { fetch } = createTestApp({
  mount: [(app) => app.route('/api/v1/inquiry', inquiryRouter)],
});

const loadInfo = async () => {
  const response = await fetch(get('/api/v1/inquiry/info'));
  expect(response.status).toBe(200);
  return (await json<{ types: Record<string, InquiryTypeInfo> }>(response)).data.types;
};

describe('GET /api/v1/inquiry/info', () => {
  it('answers without a session and lists every registered handler', async () => {
    const types = await loadInfo();
    expect(Object.keys(types).sort()).toEqual(Object.keys(inquiryHandlers).sort());
  });

  it('reports each type’s declared source and target models and its handler rules', async () => {
    const types = await loadInfo();
    for (const [type, handler] of Object.entries(inquiryHandlers)) {
      const { sources, targets } = INQUIRY_TYPES[type as InquiryType];
      expect(types[type]!.sources).toEqual(sources.map(({ model }) => model));
      expect(types[type]!.targets).toEqual(targets.map(({ model }) => model));
      expect(types[type]!.unique).toBe(handler.unique ?? null);
      expect(types[type]!.defaultExpirationDays).toBe(handler.defaultExpirationDays ?? null);
    }
  });

  it('describes content, resolution input and stored resolution as JSON Schema', async () => {
    const types = await loadInfo();
    expect(types.createSpace!.content.required).toEqual(['name', 'slug']);
    expect(types.createSpace!.resolution.properties).toHaveProperty('spaceId');
    expect(types.inviteOrganizationUser!.content.properties!.role!.enum).toEqual(
      Object.values(Role),
    );
    expect(types.transferSpace!.resolutionInput.properties).toHaveProperty('explanation');
  });
});
