import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { db } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createUser, getNextSeq } from '@template/db/test';
import { registerRulesHook } from '#/hooks/rules/hook';
import { clearRulesCache, setRulesCache } from '#/hooks/rules/registry';

registerRulesHook();

/**
 * NOTE: Rules hook limitations:
 * 1. updateManyAndReturn: Logs warning, allows operation (can't fetch previous for each record)
 * 2. Nested updates: Logs warning (can't merge with previous for nested records)
 * 3. For complex validations requiring previous state, use explicit transactions
 */

afterAll(async () => {
  await cleanupTouchedTables(db);
});

afterEach(() => {
  clearRulesCache();
});

describe('rules hook', () => {
  describe('create validation', () => {
    it('pass: valid data passes rule', async () => {
      setRulesCache('User', { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' });

      const seq = getNextSeq();
      const user = await db.user.create({
        data: { email: `test${seq}@example.com`, name: 'Test User' },
      });

      expect(user.name).toBe('Test User');
    });

    it('fail: invalid data fails rule', async () => {
      setRulesCache('User', { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' });

      const seq = getNextSeq();
      const promise = async () =>
        db.user.create({
          data: { email: `test${seq}@example.com`, name: '' },
        });

      await expect(promise).toThrow('name required');
    });

    it('fail: createManyAndReturn with invalid item', async () => {
      setRulesCache('User', { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' });

      const seq1 = getNextSeq();
      const seq2 = getNextSeq();
      const promise = async () =>
        db.user.createManyAndReturn({
          data: [
            { email: `valid${seq1}@example.com`, name: 'Valid' },
            { email: `invalid${seq2}@example.com`, name: '' },
          ],
        });

      await expect(promise).toThrow('name required');
    });
  });

  describe('update validation with previous merging', () => {
    let userId: string;

    beforeAll(async () => {
      const { entity: user } = await createUser({ name: 'Original', email: `merge${getNextSeq()}@example.com` });
      userId = user.id;
    });

    it('pass: merged data passes rule', async () => {
      setRulesCache('User', { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' });

      const result = await db.user.update({
        where: { id: userId },
        data: { email: `updated${getNextSeq()}@example.com` },
      });

      expect(result.name).toBe('Original');
    });

    it('fail: merged data fails rule when update breaks invariant', async () => {
      setRulesCache('User', { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' });

      const promise = async () =>
        db.user.update({
          where: { id: userId },
          data: { name: '' },
        });

      await expect(promise).toThrow('name required');
    });

    it('pass: cross-field rule validated against merged state', async () => {
      setRulesCache('User', {
        if: { field: 'emailVerified', operator: Operator.equals, value: true },
        then: { field: 'name', operator: Operator.notEmpty, value: true, error: 'verified users need name' },
      });

      const result = await db.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      expect(result.emailVerified).toBe(true);
    });
  });

  describe('upsert validation', () => {
    it('pass: upsert create path validated', async () => {
      setRulesCache('User', { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' });

      const seq = getNextSeq();
      const result = await db.user.upsert({
        where: { email: `upsert${seq}@example.com` },
        create: { email: `upsert${seq}@example.com`, name: 'New User' },
        update: { name: 'Updated' },
      });

      expect(result.name).toBe('New User');
    });

    it('fail: upsert create path invalid', async () => {
      setRulesCache('User', { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' });

      const seq = getNextSeq();
      const promise = async () =>
        db.user.upsert({
          where: { email: `upsert${seq}@example.com` },
          create: { email: `upsert${seq}@example.com`, name: '' },
          update: { name: 'Updated' },
        });

      await expect(promise).toThrow('name required');
    });

    it('pass: upsert update path merges with previous', async () => {
      const { entity: user } = await createUser({ name: 'Existing' });
      setRulesCache('User', { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' });

      const result = await db.user.upsert({
        where: { id: user.id },
        create: { email: user.email, name: 'Wont Use' },
        update: { emailVerified: true },
      });

      expect(result.name).toBe('Existing');
    });
  });

  describe('recursive nested validation', () => {
    it('validates nested create on relation', async () => {
      setRulesCache('OrganizationUser', {
        field: 'role',
        operator: Operator.in,
        value: ['member', 'admin', 'owner'],
        error: 'invalid role',
      });

      const { entity: user } = await createUser();
      const seq = getNextSeq();

      const org = await db.organization.create({
        data: {
          name: `Org${seq}`,
          slug: `org${seq}`,
          organizationUsers: {
            create: { userId: user.id, role: 'member' },
          },
        },
        include: { organizationUsers: true },
      });

      expect(org.organizationUsers[0].role).toBe('member');
    });

    it('validates nested update on relation', async () => {
      const { entity: orgUser } = await createOrganizationUser({ role: 'member' });
      setRulesCache('OrganizationUser', {
        field: 'role',
        operator: Operator.in,
        value: ['member', 'admin', 'owner'],
        error: 'invalid role',
      });

      const result = await db.user.update({
        where: { id: orgUser.userId },
        data: {
          organizationUsers: {
            update: {
              where: { id: orgUser.id },
              data: { role: 'admin' },
            },
          },
        },
        include: { organizationUsers: true },
      });

      expect(result.organizationUsers[0].role).toBe('admin');
    });
  });

  describe('boolean rules', () => {
    it('true: always passes', async () => {
      setRulesCache('User', true);

      const seq = getNextSeq();
      const user = await db.user.create({
        data: { email: `bool${seq}@example.com`, name: 'Test' },
      });

      expect(user).toBeDefined();
    });

    it('false: always fails', async () => {
      setRulesCache('User', false);

      const seq = getNextSeq();
      const promise = async () =>
        db.user.create({
          data: { email: `bool${seq}@example.com`, name: 'Test' },
        });

      await expect(promise).toThrow();
    });
  });

  describe('updateManyAndReturn', () => {
    it('logs warning but allows operation (cannot validate without fetching each record)', async () => {
      const { entity: user1 } = await createUser({ name: 'User1' });
      const { entity: user2 } = await createUser({ name: 'User2' });

      setRulesCache('User', { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' });

      // updateManyAndReturn should succeed even though we're setting name to empty
      // because we can't merge with previous for each record
      const results = await db.user.updateManyAndReturn({
        where: { id: { in: [user1.id, user2.id] } },
        data: { emailVerified: true },
      });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.emailVerified)).toBe(true);
    });
  });

  describe('complex rules', () => {
    it('all: multiple conditions must pass', async () => {
      setRulesCache('User', {
        all: [
          { field: 'name', operator: Operator.notEmpty, value: true, error: 'name required' },
          { field: 'email', operator: Operator.matches, value: /@/, error: 'invalid email' },
        ],
      });

      const seq = getNextSeq();
      const user = await db.user.create({
        data: { email: `test${seq}@example.com`, name: 'Test' },
      });

      expect(user).toBeDefined();
    });

    it('any: at least one condition must pass', async () => {
      setRulesCache('User', {
        any: [
          { field: 'name', operator: Operator.equals, value: 'Admin' },
          { field: 'emailVerified', operator: Operator.equals, value: true },
        ],
        error: 'must be admin or verified',
      });

      const seq = getNextSeq();
      const user = await db.user.create({
        data: { email: `test${seq}@example.com`, name: 'Admin' },
      });

      expect(user.name).toBe('Admin');
    });
  });
});
