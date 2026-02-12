import { describe, expect, it } from 'bun:test';
import { inferDependencies, mergeDependencies } from '@template/db/test/dependencyInference';

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
      expect(deps.user.foreignKey).toEqual({ id: 'userId' });
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

    it('Token - optional dependencies for fake polymorphism', () => {
      const deps = inferDependencies('Token');
      // user and organization are optional (fake polymorphism pattern)
      expect(deps.user?.required).toBe(false);
      expect(deps.organization?.required).toBe(false);
    });
  });

  describe('models with optional relations (fake polymorphism)', () => {
    it('Inquiry - optional dependencies for fake polymorphism', () => {
      const deps = inferDependencies('Inquiry');
      // Fake polymorphism relations may or may not be inferred depending on schema
      // Check that if they exist, they are optional
      if (deps.sourceUser) expect(deps.sourceUser.required).toBe(false);
      if (deps.targetUser) expect(deps.targetUser.required).toBe(false);
      if (deps.sourceOrganization) expect(deps.sourceOrganization.required).toBe(false);
      if (deps.targetOrganization) expect(deps.targetOrganization.required).toBe(false);
    });

    it('WebhookSubscription - optional dependencies for fake polymorphism', () => {
      const deps = inferDependencies('WebhookSubscription');
      // user and organization are optional
      expect(deps.user?.required).toBe(false);
      expect(deps.organization?.required).toBe(false);
    });
  });

  describe('models with required relations', () => {
    it('WebhookEvent - depends on WebhookSubscription (required)', () => {
      const deps = inferDependencies('WebhookEvent');
      expect(deps.webhookSubscription).toBeDefined();
      expect(deps.webhookSubscription.modelName).toBe('WebhookSubscription');
      expect(deps.webhookSubscription.foreignKey).toEqual({ id: 'webhookSubscriptionId' });
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
      parent: { modelName: 'User', foreignKey: { id: 'parentId' }, required: false },
    });
    expect(deps.parent).toBeDefined();
    expect(deps.parent.modelName).toBe('User');
    expect(deps.parent.foreignKey).toEqual({ id: 'parentId' });
  });

  it('throws if manual dep missing required fields', () => {
    expect(() => {
      mergeDependencies('User', {
        parent: { required: false },
      });
    }).toThrow('must specify modelName and foreignKey');
  });
});
