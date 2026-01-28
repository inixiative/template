import { describe, it, expect, afterAll } from 'bun:test';
import { db } from '@template/db';
import { createUser, createOrganization, createOrganizationUser, getNextSeq, cleanupTouchedTables } from '@template/db/test';
import { registerRulesHook } from '#/hooks/rules/hook';

// Polymorphism validation is now handled via rules (auto-injected from FalsePolymorphismRegistry)
registerRulesHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
});

describe('falsePolymorphism hook', () => {
  it('pass: User owner with userId', async () => {
    const { entity: user } = await createUser();
    const seq = getNextSeq();

    const token = await db.token.create({
      data: { name: 'test', keyHash: `h${seq}`, keyPrefix: `p${seq}`, ownerModel: 'User', userId: user.id },
    });

    expect(token.userId).toBe(user.id);
    expect(token.organizationId).toBeNull();
  });

  it('pass: Organization owner with organizationId', async () => {
    const { entity: org } = await createOrganization();
    const seq = getNextSeq();

    const token = await db.token.create({
      data: { name: 'test', keyHash: `h${seq}`, keyPrefix: `p${seq}`, ownerModel: 'Organization', organizationId: org.id },
    });

    expect(token.organizationId).toBe(org.id);
    expect(token.userId).toBeNull();
  });

  it('pass: OrganizationUser owner with both FKs', async () => {
    const { entity: orgUser } = await createOrganizationUser();
    const seq = getNextSeq();

    const token = await db.token.create({
      data: {
        name: 'test',
        keyHash: `h${seq}`,
        keyPrefix: `p${seq}`,
        ownerModel: 'OrganizationUser',
        userId: orgUser.userId,
        organizationId: orgUser.organizationId,
      },
    });

    expect(token.userId).toBe(orgUser.userId);
    expect(token.organizationId).toBe(orgUser.organizationId);
  });

  it('fail: User owner with extra organizationId', async () => {
    const { entity: user } = await createUser();
    const { entity: org } = await createOrganization();
    const seq = getNextSeq();

    const promise = async () =>
      db.token.create({
        data: { name: 'test', keyHash: `h${seq}`, keyPrefix: `p${seq}`, ownerModel: 'User', userId: user.id, organizationId: org.id },
      });

    await expect(promise).toThrow('cannot have organizationId');
  });

  it('fail: createManyAndReturn with invalid item', async () => {
    const { entity: user } = await createUser();
    const { entity: org } = await createOrganization();
    const seq1 = getNextSeq();
    const seq2 = getNextSeq();

    const promise = async () =>
      db.token.createManyAndReturn({
        data: [
          { name: 'valid', keyHash: `h${seq1}`, keyPrefix: `p${seq1}`, ownerModel: 'User', userId: user.id },
          { name: 'invalid', keyHash: `h${seq2}`, keyPrefix: `p${seq2}`, ownerModel: 'User', userId: user.id, organizationId: org.id },
        ],
      });

    await expect(promise).toThrow('cannot have organizationId');
  });

  describe('recursive nested validation', () => {
    it('pass: nested create with valid polymorphism', async () => {
      const { entity: user } = await createUser();
      const seq = getNextSeq();

      const result = await db.user.update({
        where: { id: user.id },
        data: {
          tokens: {
            create: {
              name: 'nested',
              keyHash: `h${seq}`,
              keyPrefix: `p${seq}`,
              ownerModel: 'User',
            },
          },
        },
        include: { tokens: true },
      });

      expect(result.tokens[0].ownerModel).toBe('User');
      expect(result.tokens[0].userId).toBe(user.id);
    });

    it('fail: nested create with extra FK via relation', async () => {
      const { entity: org } = await createOrganization();
      const { entity: user } = await createUser();
      const seq = getNextSeq();

      const promise = async () =>
        db.organization.update({
          where: { id: org.id },
          data: {
            tokens: {
              create: {
                name: 'nested',
                keyHash: `h${seq}`,
                keyPrefix: `p${seq}`,
                ownerModel: 'Organization',
                userId: user.id, // Invalid - Organization owner can't have userId
              },
            },
          },
        });

      await expect(promise).toThrow('cannot have userId');
    });

    it('pass: upsert create path with valid polymorphism', async () => {
      const { entity: user } = await createUser();
      const seq = getNextSeq();

      const result = await db.token.upsert({
        where: { id: 'nonexistent' },
        create: {
          name: 'upsert-create',
          keyHash: `h${seq}`,
          keyPrefix: `p${seq}`,
          ownerModel: 'User',
          userId: user.id,
        },
        update: { name: 'wont-use' },
      });

      expect(result.ownerModel).toBe('User');
    });

    it('fail: upsert create path with invalid polymorphism', async () => {
      const { entity: user } = await createUser();
      const { entity: org } = await createOrganization();
      const seq = getNextSeq();

      const promise = async () =>
        db.token.upsert({
          where: { id: 'nonexistent' },
          create: {
            name: 'upsert-create',
            keyHash: `h${seq}`,
            keyPrefix: `p${seq}`,
            ownerModel: 'User',
            userId: user.id,
            organizationId: org.id, // Invalid - User owner can't have orgId
          },
          update: { name: 'wont-use' },
        });

      await expect(promise).toThrow('cannot have organizationId');
    });

    it('fail: nested createMany with invalid item inside update', async () => {
      const { entity: user } = await createUser();
      const { entity: org } = await createOrganization();
      const seq1 = getNextSeq();
      const seq2 = getNextSeq();

      const promise = async () =>
        db.user.update({
          where: { id: user.id },
          data: {
            tokens: {
              createMany: {
                data: [
                  { name: 'valid', keyHash: `h${seq1}`, keyPrefix: `p${seq1}`, ownerModel: 'User', userId: user.id },
                  { name: 'invalid', keyHash: `h${seq2}`, keyPrefix: `p${seq2}`, ownerModel: 'User', userId: user.id, organizationId: org.id },
                ],
              },
            },
          },
        });

      await expect(promise).toThrow('cannot have organizationId');
    });

    it('pass: regular update without nested creates', async () => {
      const { entity: user } = await createUser();
      const seq = getNextSeq();

      const token = await db.token.create({
        data: { name: 'original', keyHash: `h${seq}`, keyPrefix: `p${seq}`, ownerModel: 'User', userId: user.id },
      });

      const updated = await db.token.update({
        where: { id: token.id },
        data: { name: 'updated' },
      });

      expect(updated.name).toBe('updated');
      expect(updated.ownerModel).toBe('User');
    });
  });
});
