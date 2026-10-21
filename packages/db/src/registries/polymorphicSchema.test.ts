import { describe, expect, expectTypeOf, it } from 'bun:test';
import { polymorphicSchema } from '@template/db/registries/polymorphicSchema';
import { appPathSchema, uuidV7Schema } from '@template/shared/utils';

const organizationId = '019a0000-0000-7000-8000-000000000001';
const spaceId = '019a0000-0000-7000-8000-000000000002';
const userId = '019a0000-0000-7000-8000-000000000003';

describe('polymorphicSchema', () => {
  const integrationOwner = polymorphicSchema('Integration', 'ownerModel');

  it('accepts a value carrying exactly its required FKs', () => {
    expect(integrationOwner.parse({ ownerModel: 'Organization', organizationId })).toEqual({
      ownerModel: 'Organization',
      organizationId,
    });
    expect(
      integrationOwner.safeParse({ ownerModel: 'OrganizationUser', organizationId, userId })
        .success,
    ).toBe(true);
  });

  it('refuses a missing required FK, a foreign FK, and an unknown value', () => {
    expect(integrationOwner.safeParse({ ownerModel: 'Organization' }).success).toBe(false);
    expect(
      integrationOwner.safeParse({ ownerModel: 'Organization', organizationId, spaceId }).success,
    ).toBe(false);
    expect(integrationOwner.safeParse({ ownerModel: 'Space', spaceId }).success).toBe(false);
    expect(
      integrationOwner.safeParse({ ownerModel: 'Space', organizationId, spaceId }).success,
    ).toBe(true);
    expect(integrationOwner.safeParse({ ownerModel: 'Tag', organizationId }).success).toBe(false);
    expect(
      integrationOwner.safeParse({ ownerModel: 'Organization', organizationId: 'nope' }).success,
    ).toBe(false);
  });

  it('only keeps the listed values', () => {
    const someOwners = polymorphicSchema('Integration', 'ownerModel', {
      only: ['User', 'Organization', 'Space'],
    });
    expect(
      someOwners.safeParse({ ownerModel: 'OrganizationUser', organizationId, userId }).success,
    ).toBe(false);
    expect(someOwners.safeParse({ ownerModel: 'Organization', organizationId }).success).toBe(true);
  });

  it('omits a column from every arm and then refuses it', () => {
    const callerOwned = polymorphicSchema('Integration', 'ownerModel', { omit: ['userId'] });
    expect(callerOwned.parse({ ownerModel: 'User' })).toEqual({ ownerModel: 'User' });
    expect(callerOwned.safeParse({ ownerModel: 'User', userId }).success).toBe(false);
    expect(callerOwned.safeParse({ ownerModel: 'OrganizationUser', organizationId }).success).toBe(
      true,
    );
  });

  it('builds a discriminator-only arm for a value with no FKs', () => {
    const tagOwner = polymorphicSchema('Tag', 'ownerModel');
    expect(tagOwner.safeParse({ ownerModel: 'platform' }).success).toBe(true);
    expect(tagOwner.safeParse({ ownerModel: 'platform', organizationId }).success).toBe(false);
  });

  it('extends every arm with a shared shape', () => {
    const withReturnUrl = polymorphicSchema('Integration', 'ownerModel', {
      only: ['User', 'Organization'],
      omit: ['userId'],
      extend: { returnUrl: appPathSchema.optional() },
    });
    expect(withReturnUrl.parse({ ownerModel: 'User', returnUrl: '/settings' })).toEqual({
      ownerModel: 'User',
      returnUrl: '/settings',
    });
    expect(
      withReturnUrl.safeParse({ ownerModel: 'User', returnUrl: 'https://x.test' }).success,
    ).toBe(false);
  });

  it('throws at build time on an unknown model, axis, or value', () => {
    expect(() => polymorphicSchema('Integration', 'nope' as 'ownerModel')).toThrow(
      'no false-polymorphic axis',
    );
    expect(() =>
      polymorphicSchema('Integration', 'ownerModel', { only: ['Tag' as 'User'] }),
    ).toThrow('has no value Tag');
    expect(() =>
      polymorphicSchema('Integration', 'ownerModel', {
        // @ts-expect-error extend may not redefine an axis column
        extend: { spaceId: uuidV7Schema.optional() },
      }),
    ).toThrow('extend cannot redefine spaceId');
    expect(() => polymorphicSchema('Flow' as 'Integration', 'ownerModel')).toThrow(
      'no false-polymorphic axis',
    );
  });

  it('narrows the parsed type per arm', () => {
    const owner = polymorphicSchema('Integration', 'ownerModel', {
      only: ['User', 'Organization', 'Space'],
      omit: ['userId'],
    }).parse({ ownerModel: 'Space', organizationId, spaceId });

    expectTypeOf(owner.ownerModel).toEqualTypeOf<'User' | 'Organization' | 'Space'>();
    if (owner.ownerModel === 'Space') {
      expectTypeOf(owner).toEqualTypeOf<{
        ownerModel: 'Space';
        organizationId: string;
        spaceId: string;
      }>();
    }
    if (owner.ownerModel === 'User') expectTypeOf(owner).toEqualTypeOf<{ ownerModel: 'User' }>();
  });
});
