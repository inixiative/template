import { beforeEach, describe, expect, it } from 'bun:test';
import { clearRuntimeCaches, getAccessorRelations, getModelRelations, getRuntimeDataModel } from './runtimeDataModel';

describe('getRuntimeDataModel', () => {
  beforeEach(() => {
    clearRuntimeCaches();
  });

  it('returns models from generated client', () => {
    const dm = getRuntimeDataModel();

    expect(dm.models).toBeDefined();
    expect(dm.models.User).toBeDefined();
    expect(dm.models.Organization).toBeDefined();
    expect(dm.models.Token).toBeDefined();
  });

  it('contains fields for each model', () => {
    const dm = getRuntimeDataModel();
    const user = dm.models.User;

    expect(user.fields).toBeArray();
    expect(user.fields.length).toBeGreaterThan(0);

    const idField = user.fields.find((f) => f.name === 'id');
    expect(idField).toBeDefined();
    expect(idField?.kind).toBe('scalar');
  });

  it('identifies relation fields with kind=object', () => {
    const dm = getRuntimeDataModel();
    const token = dm.models.Token;

    const userRel = token.fields.find((f) => f.name === 'user');
    expect(userRel).toBeDefined();
    expect(userRel?.kind).toBe('object');
    expect(userRel?.type).toBe('User');
    expect(userRel?.relationName).toBeDefined();
  });

  it('caches the result', () => {
    const dm1 = getRuntimeDataModel();
    const dm2 = getRuntimeDataModel();

    expect(dm1).toBe(dm2);
  });
});

describe('getModelRelations', () => {
  beforeEach(() => {
    clearRuntimeCaches();
  });

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

  it('throws for unknown model', () => {
    expect(() => getModelRelations('NonExistentModel' as never)).toThrow();
  });
});

describe('getAccessorRelations', () => {
  beforeEach(() => {
    clearRuntimeCaches();
  });

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
