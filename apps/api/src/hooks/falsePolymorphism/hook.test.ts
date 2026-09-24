import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { registerRulesHook } from '#/hooks/rules/hook';

// Polymorphism validation is now handled via rules (auto-injected from FalsePolymorphismRegistry)
registerRulesHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
});

describe('falsePolymorphism hook', () => {
  it('pass: User owner with userId', async () => {
    const { entity: user } = await createUser();

    const { entity: token } = await createToken({ ownerModel: 'User', userId: user.id });

    expect(token.userId).toBe(user.id);
    expect(token.organizationId).toBeNull();
  });

  it('pass: Organization owner with organizationId', async () => {
    const { entity: org } = await createOrganization();

    const { entity: token } = await createToken({ ownerModel: 'Organization', organizationId: org.id });

    expect(token.organizationId).toBe(org.id);
    expect(token.userId).toBeNull();
  });

  it('pass: OrganizationUser owner with both FKs', async () => {
    const { entity: orgUser } = await createOrganizationUser();

    const { entity: token } = await createToken({
      ownerModel: 'OrganizationUser',
      userId: orgUser.userId,
      organizationId: orgUser.organizationId,
    });

    expect(token.userId).toBe(orgUser.userId);
    expect(token.organizationId).toBe(orgUser.organizationId);
  });

  it('fail: User owner with extra organizationId', async () => {
    const { entity: user } = await createUser();
    const { entity: org } = await createOrganization();

    await expect(createToken({ ownerModel: 'User', userId: user.id, organizationId: org.id })).rejects.toThrow(
      'Invalid ownerModel value on Token',
    );
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
          {
            name: 'invalid',
            keyHash: `h${seq2}`,
            keyPrefix: `p${seq2}`,
            ownerModel: 'User',
            userId: user.id,
            organizationId: org.id,
          },
        ],
      });

    await expect(promise).toThrow('Invalid ownerModel value on Token');
  });

  describe('create path polymorphism validation', () => {
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

      await expect(promise).toThrow('Invalid ownerModel value on Token');
    });

    it('pass: regular update without nested creates', async () => {
      const { entity: user } = await createUser();

      const { entity: token } = await createToken({ name: 'original', ownerModel: 'User', userId: user.id });

      const updated = await db.token.update({
        where: { id: token.id },
        data: { name: 'updated' },
      });

      expect(updated.name).toBe('updated');
      expect(updated.ownerModel).toBe('User');
    });
  });

  it('pass: platform provider on a CustomerRef carries no provider key', async () => {
    const { entity: user } = await createUser();

    const { entity: ref } = await createCustomerRef({
      customerModel: 'User',
      providerModel: 'platform',
      customerUser: user,
    });

    expect(ref.providerModel).toBe('platform');
    expect(ref.providerUserId).toBeNull();
    expect(ref.providerOrganizationId).toBeNull();
    expect(ref.providerSpaceId).toBeNull();
  });

  it('fail: platform provider on a CustomerRef with a provider key', async () => {
    const { entity: user } = await createUser();
    const { entity: org } = await createOrganization();

    await expect(
      createCustomerRef({
        customerModel: 'User',
        providerModel: 'platform',
        customerUser: user,
        providerOrganizationId: org.id,
      }),
    ).rejects.toThrow('Invalid providerModel value on CustomerRef');
  });
});
