import { describe, expect, it } from 'bun:test';
import { emailOwnerProvider } from '@template/email/render/owner';

describe('emailOwnerProvider — the provider whose tags and segments a row sees', () => {
  it('tenant tiers scope to the tenant, user tiers to the person, platform tiers to nobody', () => {
    expect(emailOwnerProvider({ ownerModel: 'Organization', organizationId: 'o' })).toEqual({
      ownerModel: 'Organization',
      ownerId: 'o',
    });
    expect(emailOwnerProvider({ ownerModel: 'Space', spaceId: 's', organizationId: 'o' })).toEqual({
      ownerModel: 'Space',
      ownerId: 's',
    });
    expect(emailOwnerProvider({ ownerModel: 'User', userId: 'u' })).toEqual({ ownerModel: 'User', ownerId: 'u' });
    expect(emailOwnerProvider({ ownerModel: 'OrganizationUser', organizationId: 'o', userId: 'u' })).toEqual({
      ownerModel: 'User',
      ownerId: 'u',
    });
    expect(emailOwnerProvider({ ownerModel: 'SpaceUser', spaceId: 's', userId: 'u' })).toEqual({
      ownerModel: 'User',
      ownerId: 'u',
    });
    expect(emailOwnerProvider({ ownerModel: 'default' })).toBeNull();
    expect(emailOwnerProvider({ ownerModel: 'admin' })).toBeNull();
  });
});
