import { describe, expect, it } from 'bun:test';
import { Role } from '@template/db/generated/client/enums';
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

  it('reports each handler’s source and target models and its rules', async () => {
    const types = await loadInfo();
    for (const [type, handler] of Object.entries(inquiryHandlers)) {
      expect(types[type]!.sources).toEqual(handler.sources.map(({ sourceModel }) => sourceModel));
      expect(types[type]!.targets).toEqual(handler.targets.map(({ targetModel }) => targetModel));
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
