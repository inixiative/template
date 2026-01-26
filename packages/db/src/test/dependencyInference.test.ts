import { describe, it, expect } from 'bun:test';
import { inferDependencies, mergeDependencies } from './dependencyInference';

describe('inferDependencies', () => {
  describe('simple models', () => {
    it('User - no dependencies', () => {
      const deps = inferDependencies('User');
      expect(Object.keys(deps).length).toBe(0);
    });

    it('Organization - no dependencies', () => {
      const deps = inferDependencies('Organization');
      expect(Object.keys(deps).length).toBe(0);
    });

    it('Session - depends on User', () => {
      const deps = inferDependencies('Session');
      expect(deps.user).toBeDefined();
      expect(deps.user.modelName).toBe('User');
      expect(deps.user.foreignKey).toBe('userId');
      expect(deps.user.required).toBe(true);
    });
  });

  describe('models with composite FK', () => {
    it('OrganizationUser - infers user and organization separately', () => {
      const deps = inferDependencies('OrganizationUser');
      expect(deps.user).toBeDefined();
      expect(deps.user.modelName).toBe('User');
      expect(deps.organization).toBeDefined();
      expect(deps.organization.modelName).toBe('Organization');
    });

    it('Token - no dependencies (all optional for fake polymorphism)', () => {
      const deps = inferDependencies('Token');
      // All relations are optional (fake polymorphism pattern)
      expect(deps.user).toBeUndefined();
      expect(deps.organization).toBeUndefined();
      expect(deps.organizationUser).toBeUndefined();
      expect(Object.keys(deps).length).toBe(0);
    });
  });

  describe('models with optional relations (fake polymorphism)', () => {
    it('Inquiry - no dependencies (optional fake polymorphism)', () => {
      const deps = inferDependencies('Inquiry');
      // All source/target relations are optional
      expect(deps.sourceUser).toBeUndefined();
      expect(deps.targetUser).toBeUndefined();
      expect(deps.sourceOrganization).toBeUndefined();
      expect(deps.targetOrganization).toBeUndefined();
      expect(Object.keys(deps).length).toBe(0);
    });

    it('WebhookSubscription - no dependencies (optional fake polymorphism)', () => {
      const deps = inferDependencies('WebhookSubscription');
      // user and organization are optional
      expect(deps.user).toBeUndefined();
      expect(deps.organization).toBeUndefined();
      expect(Object.keys(deps).length).toBe(0);
    });

  });

  describe('models with required relations', () => {
    it('WebhookEvent - depends on WebhookSubscription (required)', () => {
      const deps = inferDependencies('WebhookEvent');
      expect(deps.webhookSubscription).toBeDefined();
      expect(deps.webhookSubscription.modelName).toBe('WebhookSubscription');
      expect(deps.webhookSubscription.foreignKey).toBe('webhookSubscriptionId');
      expect(deps.webhookSubscription.required).toBe(true);
    });
  });
});

describe('mergeDependencies', () => {
  it('removes inferred dependency with null', () => {
    const deps = mergeDependencies('Session', { user: null });
    expect(deps.user).toBeUndefined();
  });

  it('overrides inferred dependency', () => {
    const deps = mergeDependencies('Session', { user: { required: false } });
    expect(deps.user.required).toBe(false);
    expect(deps.user.modelName).toBe('User');
  });

  it('adds manual dependency', () => {
    const deps = mergeDependencies('User', {
      parent: { modelName: 'User', foreignKey: 'parentId', required: false },
    });
    expect(deps.parent).toBeDefined();
    expect(deps.parent.modelName).toBe('User');
    expect(deps.parent.foreignKey).toBe('parentId');
  });

  it('throws if manual dep missing required fields', () => {
    expect(() => {
      mergeDependencies('User', {
        parent: { required: false },
      });
    }).toThrow('must specify modelName and foreignKey');
  });
});
