import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { ArrayOperator, Operator } from '@inixiative/json-rules';
import { TagResource } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createContact,
  createTag,
  createTagAttachment,
  createUser,
} from '@template/db/test';
import { resolveUsers } from '#/lib/messaging/resolveUsers';
import { createTestApp } from '#tests/createTestApp';

describe('resolveUsers', () => {
  let alice: { id: string };
  let bob: { id: string };
  let carol: { id: string };
  let foundersTag: { id: string };
  let testDb: ReturnType<typeof createTestApp>['db'];

  beforeAll(async () => {
    const harness = createTestApp({});
    testDb = harness.db;

    const a = await createUser();
    alice = a.entity;
    const b = await createUser();
    bob = b.entity;
    const c = await createUser();
    carol = c.entity;

    // Each user gets one whatsapp contact (so messageUser can fan out later).
    await createContact({ ownerModel: 'User', type: 'whatsapp', value: { jid: '111' } }, { user: a.entity });
    await createContact({ ownerModel: 'User', type: 'whatsapp', value: { jid: '222' } }, { user: b.entity });
    await createContact({ ownerModel: 'User', type: 'whatsapp', value: { jid: '333' } }, { user: c.entity });

    // alice + bob are tagged "founders" (resource: userMessages).
    const tag = await createTag({
      name: `founders-${Date.now()}`,
      resources: [TagResource.userMessages],
    });
    foundersTag = tag.entity;
    await createTagAttachment(
      { resourceModel: TagResource.User },
      { user: a.entity, tag: tag.entity },
    );
    await createTagAttachment(
      { resourceModel: TagResource.User },
      { user: b.entity, tag: tag.entity },
    );
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
  });

  it('resolves a single user by id (rule shape)', async () => {
    const users = await resolveUsers({
      field: 'id',
      operator: Operator.equals,
      value: alice.id,
    });
    expect(users.map((u) => u.id)).toEqual([alice.id]);
  });

  it('resolves multiple users by id IN', async () => {
    const users = await resolveUsers({
      field: 'id',
      operator: Operator.in,
      value: [alice.id, carol.id],
    });
    expect(users.map((u) => u.id).sort()).toEqual([alice.id, carol.id].sort());
  });

  it('eager-loads contacts for messaging', async () => {
    const users = await resolveUsers({
      field: 'id',
      operator: Operator.equals,
      value: alice.id,
    });
    expect(users[0].contacts.length).toBeGreaterThan(0);
    expect(users[0].contacts[0].type).toBe('whatsapp');
  });

  it('matches users via tag attachment rule', async () => {
    const users = await resolveUsers({
      field: 'tagAttachments',
      arrayOperator: ArrayOperator.any,
      condition: { field: 'tag.id', operator: Operator.equals, value: foundersTag.id },
    });
    expect(users.map((u) => u.id).sort()).toEqual([alice.id, bob.id].sort());
  });

  it('returns empty when nothing matches', async () => {
    const users = await resolveUsers({
      field: 'id',
      operator: Operator.equals,
      value: '00000000-0000-0000-0000-000000000000',
    });
    expect(users).toEqual([]);
  });
});
