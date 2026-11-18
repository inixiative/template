import { describe, expect, it } from 'bun:test';
import { relationsOfModel } from '@template/db/utils/prismaMapRelations';

describe('relationsOfModel', () => {
  it('returns relations for a model', () => {
    const relations = relationsOfModel('Token');

    expect(relations).toBeArray();
    expect(relations.length).toBeGreaterThan(0);
  });

  it('includes simple FK relations', () => {
    const relations = relationsOfModel('Session');

    const userRel = relations.find((r) => r.relationName === 'user');
    expect(userRel).toBeDefined();
    expect(userRel?.targetModel).toBe('User');
    expect(userRel?.targetAccessor).toBe('user');
    // userId -> id mapping
    expect(userRel?.foreignKey).toEqual({ id: 'userId' });
  });

  it('includes composite FK relations', () => {
    const relations = relationsOfModel('Token');

    const orgUserRel = relations.find((r) => r.relationName === 'organizationUser');
    expect(orgUserRel).toBeDefined();
    expect(orgUserRel?.targetModel).toBe('OrganizationUser');
    expect(orgUserRel?.foreignKey).toEqual({
      organizationId: 'organizationId',
      userId: 'userId',
    });
  });

  it('handles renamed FK references', () => {
    const relations = relationsOfModel('Token');

    // space: fields: [organizationId, spaceId], references: [organizationId, id]
    const spaceRel = relations.find((r) => r.relationName === 'space');
    expect(spaceRel).toBeDefined();
    expect(spaceRel?.foreignKey).toEqual({
      organizationId: 'organizationId',
      id: 'spaceId',
    });
  });

  it('returns null FK for reverse relations', () => {
    const relations = relationsOfModel('OrganizationUser');

    // tokens is a reverse relation (Token[] on OrganizationUser)
    const tokensRel = relations.find((r) => r.relationName === 'tokens');
    expect(tokensRel).toBeDefined();
    expect(tokensRel?.foreignKey).toBeNull();
  });

  it('resolves named relations (e.g. @relation("InquirySource", fields: [...]))', () => {
    const relations = relationsOfModel('Inquiry');

    const sourceOrgRel = relations.find((r) => r.relationName === 'sourceOrganization');
    expect(sourceOrgRel).toBeDefined();
    expect(sourceOrgRel?.targetModel).toBe('Organization');
    expect(sourceOrgRel?.foreignKey).toEqual({ id: 'sourceOrganizationId' });

    const targetUserRel = relations.find((r) => r.relationName === 'targetUser');
    expect(targetUserRel).toBeDefined();
    expect(targetUserRel?.foreignKey).toEqual({ id: 'targetUserId' });
  });

  it('throws for unknown model', () => {
    expect(() => relationsOfModel('NonExistentModel' as never)).toThrow();
  });
});
