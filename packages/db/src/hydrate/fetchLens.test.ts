import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { type Condition, type LensNarrowing, Operator } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { Db } from '@template/db/clientTypes';
import { fetchLens } from '@template/db/hydrate/fetchLens';
import { lensFor } from '@template/db/lens/lensFor';
import { cleanupTouchedTables, createOrganizationUser, createUser, registerTestTracker } from '@template/db/test';

const eq = (field: string, value: unknown): Condition =>
  ({ field, operator: Operator.equals, value }) as unknown as Condition;
const inList = (field: string, value: unknown[]): Condition =>
  ({ field, operator: Operator.in, value }) as unknown as Condition;

const usersWhere = (where: Condition): LensNarrowing => ({
  parent: lensFor('User'),
  root: { where, picks: ['id', 'name', 'email'] },
});

describe('fetchLens', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('fails closed on an unscoped lens (no where) before touching the db', async () => {
    await expect(fetchLens({} as Db, lensFor('Inquiry'))).rejects.toThrow();
  });

  it('fetches the single row matching a scoped where', async () => {
    const { entity: alice } = await createUser({ name: 'Alice' });
    await createUser({ name: 'Bob' });

    const rows = await fetchLens<{ id: string; name: string; email: string }>(db, usersWhere(eq('id', alice.id)));

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(alice.id);
    expect(rows[0].name).toBe('Alice');
    expect(rows[0].email).toBe(alice.email);
  });

  it('returns an empty array when the where matches nothing', async () => {
    await createUser();

    const rows = await fetchLens(db, usersWhere(eq('id', '00000000-0000-7000-8000-0000000000ff')));

    expect(rows).toEqual([]);
  });

  it('fetches every row matching an `in` condition (and nothing outside it)', async () => {
    const { entity: a } = await createUser();
    const { entity: b } = await createUser();
    await createUser(); // outside the set — must not be returned

    const rows = await fetchLens<{ id: string }>(db, usersWhere(inList('id', [a.id, b.id])));

    expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('hydrates a declared relation via the lens include', async () => {
    const { entity: orgUser, context } = await createOrganizationUser();
    const orgId = context.organization!.id;

    const rows = await fetchLens<{ id: string; organizationUsers: Array<{ userId: string }> }>(db, {
      parent: lensFor('Organization'),
      root: {
        where: eq('id', orgId),
        picks: ['id', 'name'],
        relations: { organizationUsers: { picks: ['userId', 'role'] } },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(orgId);
    expect(rows[0].organizationUsers.some((ou) => ou.userId === orgUser.userId)).toBe(true);
  });
});
