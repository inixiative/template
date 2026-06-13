import { describe, expect, it } from 'bun:test';
import { getAccessorRelations, getModelRelations } from '@template/db/utils/prismaMapRelations';

describe('getModelRelations', () => {
  it('returns relations for a model', () => {
    const relations = getModelRelations('Token');

    expect(relations).toBeArray();
    expect(relations.length).toBeGreaterThan(0);
  });

  it('includes simple FK relations', () => {
    const relations = getModelRelations('Session');

    const userRel = relations.find((r) => r.relationName === 'user');
    expect(userRel).toBeDefined();
    expect(userRel?.targetModel).toBe('User');
    expect(userRel?.targetAccessor).toBe('user');
    // userId -> id mapping
    expect(userRel?.foreignKey).toEqual({ id: 'userId' });
  });

  it('includes composite FK relations', () => {
    const relations = getModelRelations('Token');

    const orgUserRel = relations.find((r) => r.relationName === 'organizationUser');
    expect(orgUserRel).toBeDefined();
    expect(orgUserRel?.targetModel).toBe('OrganizationUser');
    expect(orgUserRel?.foreignKey).toEqual({
      organizationId: 'organizationId',
      userId: 'userId',
    });
  });

  it('handles renamed FK references', () => {
    const relations = getModelRelations('Token');

    // space: fields: [organizationId, spaceId], references: [organizationId, id]
    const spaceRel = relations.find((r) => r.relationName === 'space');
    expect(spaceRel).toBeDefined();
    expect(spaceRel?.foreignKey).toEqual({
      organizationId: 'organizationId',
      id: 'spaceId',
    });
  });

  it('returns null FK for reverse relations', () => {
    const relations = getModelRelations('OrganizationUser');

    // tokens is a reverse relation (Token[] on OrganizationUser)
    const tokensRel = relations.find((r) => r.relationName === 'tokens');
    expect(tokensRel).toBeDefined();
    expect(tokensRel?.foreignKey).toBeNull();
  });

  it('resolves named relations (e.g. @relation("InquirySource", fields: [...]))', () => {
    const relations = getModelRelations('Inquiry');

    const sourceOrgRel = relations.find((r) => r.relationName === 'sourceOrganization');
    expect(sourceOrgRel).toBeDefined();
    expect(sourceOrgRel?.targetModel).toBe('Organization');
    expect(sourceOrgRel?.foreignKey).toEqual({ id: 'sourceOrganizationId' });

    const targetUserRel = relations.find((r) => r.relationName === 'targetUser');
    expect(targetUserRel).toBeDefined();
    expect(targetUserRel?.foreignKey).toEqual({ id: 'targetUserId' });
  });

  it('throws for unknown model', () => {
    expect(() => getModelRelations('NonExistentModel' as never)).toThrow();
  });
});

describe('getAccessorRelations', () => {
  it('works with camelCase accessor names', () => {
    const relations = getAccessorRelations('organizationUser');

    expect(relations).toBeArray();
    const orgRel = relations.find((r) => r.relationName === 'organization');
    expect(orgRel).toBeDefined();
  });

  it('returns same results as getModelRelations', () => {
    const fromModel = getModelRelations('OrganizationUser');
    const fromAccessor = getAccessorRelations('organizationUser');

    expect(fromModel).toEqual(fromAccessor);
  });
});
