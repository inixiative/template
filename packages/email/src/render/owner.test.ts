import { describe, expect, it } from 'bun:test';
import { emailLensOwnerOf } from '@template/email/render/owner';

describe('emailLensOwnerOf — the provider whose tags and segments a row sees', () => {
  it('tenant tiers scope to the tenant, user tiers to the user, platform tiers to nobody', () => {
    expect(emailLensOwnerOf({ ownerModel: 'Organization', organizationId: 'o' })).toEqual({
      ownerModel: 'Organization',
      ownerId: 'o',
    });
    expect(emailLensOwnerOf({ ownerModel: 'Space', spaceId: 's', organizationId: 'o' })).toEqual({
      organizationId: 'o',
      ownerModel: 'Space',
      ownerId: 's',
    });
    expect(emailLensOwnerOf({ ownerModel: 'User', userId: 'u' })).toEqual({
      ownerModel: 'User',
      ownerId: 'u',
    });
    expect(
      emailLensOwnerOf({ ownerModel: 'OrganizationUser', organizationId: 'o', userId: 'u' }),
    ).toEqual({
      ownerModel: 'User',
      ownerId: 'u',
    });
    expect(emailLensOwnerOf({ ownerModel: 'SpaceUser', spaceId: 's', userId: 'u' })).toEqual({
      ownerModel: 'User',
      ownerId: 'u',
    });
    expect(emailLensOwnerOf({ ownerModel: 'default' })).toBeNull();
    expect(emailLensOwnerOf({ ownerModel: 'admin' })).toBeNull();
  });
});
