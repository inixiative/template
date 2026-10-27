import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { ContactRegistry } from '@template/shared/contact';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { contactRouter } from '#/modules/contact';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { get, json, post } from '#tests/utils/request';

type ContactTypeInfo = {
  label: string;
  input: { anyOf?: { required?: string[] }[] };
  value: { properties?: Record<string, unknown>; required?: string[] };
  subtype: { mode: string; values: string[] };
  uniqueness: string;
};

describe('GET /api/v1/contact/info', () => {
  let user: User;
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];

  beforeAll(async () => {
    registerContactRulesHook();
    user = (await createUser()).entity;
    const harness = createTestApp({
      mockUser: user,
      mount: [
        (app) => app.route('/api/v1/contact', contactRouter),
        (app) => app.route('/api/v1/me', meRouter),
      ],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  const loadInfo = async () => {
    const anonymous = createTestApp({
      mount: [(app) => app.route('/api/v1/contact', contactRouter)],
    });
    const response = await anonymous.fetch(get('/api/v1/contact/info'));
    expect(response.status).toBe(200);
    return (await json<{ types: Record<string, ContactTypeInfo> }>(response)).data.types;
  };

  it('answers without a session and lists every registered contact type', async () => {
    const types = await loadInfo();
    expect(Object.keys(types).sort()).toEqual(Object.keys(ContactRegistry).sort());
  });

  it('reports subtype rules and value shapes from the registry', async () => {
    const types = await loadInfo();
    expect(types.phone!.subtype.mode).toBe('optional');
    expect(types.phone!.subtype.values.length).toBeGreaterThan(0);
    expect(types.whatsapp!.subtype).toEqual({ mode: 'forbidden', values: [] });
    expect(types.phone!.value.required).toEqual(['e164', 'country']);
    expect(types.github!.input.anyOf?.map((branch) => branch.required)).toEqual([
      ['url'],
      ['classifier', 'handle'],
    ]);
  });

  it('describes an input the create route accepts and the canonical value it stores', async () => {
    const types = await loadInfo();
    const [urlForm] = types.github!.input.anyOf!;
    expect(urlForm!.required).toEqual(['url']);

    const response = await fetch(
      post('/api/v1/me/contacts', {
        type: 'github',
        value: { url: 'https://github.com/inixiative' },
      }),
    );
    expect(response.status).toBe(201);
    const { data } = await json<{ value: Record<string, unknown> }>(response);
    expect(Object.keys(data.value).sort()).toEqual(types.github!.value.required!.slice().sort());
  });
});
