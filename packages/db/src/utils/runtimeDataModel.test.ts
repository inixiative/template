import { describe, it, expect } from 'bun:test';
import { getRuntimeDataModel, getModelRelations } from './runtimeDataModel';

describe('getRuntimeDataModel', () => {
  it('parses all models from generated client', () => {
    const dm = getRuntimeDataModel();

    expect(dm.models).toBeDefined();
    expect(Object.keys(dm.models)).toContain('User');
    expect(Object.keys(dm.models)).toContain('Session');
    expect(Object.keys(dm.models)).toContain('Organization');
    expect(Object.keys(dm.models)).toContain('Token');
  });

  it('caches result on subsequent calls', () => {
    const dm1 = getRuntimeDataModel();
    const dm2 = getRuntimeDataModel();

    expect(dm1).toBe(dm2);
  });

  it('contains field metadata for each model', () => {
    const dm = getRuntimeDataModel();
    const userModel = dm.models.User;

    expect(userModel.fields).toBeDefined();
    expect(userModel.fields.length).toBeGreaterThan(0);

    const idField = userModel.fields.find((f) => f.name === 'id');
    expect(idField).toBeDefined();
    expect(idField?.kind).toBe('scalar');
    expect(idField?.type).toBe('String');
  });
});

describe('getModelRelations', () => {
  it('Session - finds user relation with FK', () => {
    const relations = getModelRelations('Session');

    const userRelation = relations.find((r) => r.relationName === 'user');
    expect(userRelation).toBeDefined();
    expect(userRelation?.targetModel).toBe('User');
    expect(userRelation?.foreignKey).toBe('userId');
  });

  it('User - has no inbound relations (only outbound)', () => {
    const relations = getModelRelations('User');

    // User has sessions, tokens, etc. but those are outbound (User -> Session)
    // No FK on User side for those
    const sessionsRelation = relations.find((r) => r.relationName === 'sessions');
    expect(sessionsRelation?.foreignKey).toBeNull();
  });

  it('Token - finds simple relations with FK', () => {
    const relations = getModelRelations('Token');

    const userRelation = relations.find((r) => r.relationName === 'user');
    expect(userRelation?.targetModel).toBe('User');
    expect(userRelation?.foreignKey).toBe('userId');

    const orgRelation = relations.find((r) => r.relationName === 'organization');
    expect(orgRelation?.targetModel).toBe('Organization');
    expect(orgRelation?.foreignKey).toBe('organizationId');
  });

  it('Token - organizationUser has null FK (composite)', () => {
    const relations = getModelRelations('Token');

    const orgUserRelation = relations.find((r) => r.relationName === 'organizationUser');
    expect(orgUserRelation?.targetModel).toBe('OrganizationUser');
    // Composite FK (organizationId + userId) - no single FK field
    expect(orgUserRelation?.foreignKey).toBeNull();
  });

  it('OrganizationUser - finds both user and organization', () => {
    const relations = getModelRelations('OrganizationUser');

    const userRelation = relations.find((r) => r.relationName === 'user');
    expect(userRelation?.targetModel).toBe('User');
    expect(userRelation?.foreignKey).toBe('userId');

    const orgRelation = relations.find((r) => r.relationName === 'organization');
    expect(orgRelation?.targetModel).toBe('Organization');
    expect(orgRelation?.foreignKey).toBe('organizationId');
  });

  it('throws for unknown model', () => {
    expect(() => getModelRelations('NonExistent')).toThrow('not found in runtimeDataModel');
  });
});
