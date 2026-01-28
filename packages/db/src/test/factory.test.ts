import { describe, it, expect, beforeEach } from 'bun:test';
import { faker } from '@faker-js/faker';
import { OrganizationRole } from '@template/db/generated/client/client';
import { createFactory, getNextSeq, resetSequence } from './factory';

beforeEach(() => {
  resetSequence();
});

describe('createFactory', () => {
  describe('build (in-memory)', () => {
    it('User - builds with defaults', async () => {
      const userFactory = createFactory('User', {
        defaults: () => ({
          email: `user-${getNextSeq()}@test.com`,
          emailVerified: true,
          name: faker.person.fullName(),
        }),
      });

      const { entity: user, context } = await userFactory.build();

      expect(user.id).toBeDefined();
      expect(user.email).toMatch(/^user-\d+@test\.com$/);
      expect(user.emailVerified).toBe(true);
      expect(context.user).toBe(user);
    });

    it('User - builds with overrides', async () => {
      const userFactory = createFactory('User', {
        defaults: () => ({
          email: `user-${getNextSeq()}@test.com`,
          emailVerified: true,
        }),
      });

      const { entity: user } = await userFactory.build({ email: 'custom@test.com' });

      expect(user.email).toBe('custom@test.com');
    });

    it('Session - auto-creates User dependency', async () => {
      // Register User factory first
      createFactory('User', {
        defaults: () => ({
          email: `user-${getNextSeq()}@test.com`,
          emailVerified: true,
        }),
      });

      const sessionFactory = createFactory('Session', {
        defaults: () => ({
          token: faker.string.alphanumeric(32),
          expiresAt: new Date(Date.now() + 86400000),
        }),
      });

      const { entity: session, context } = await sessionFactory.build();

      expect(session.userId).toBeDefined();
      expect(context.user).toBeDefined();
      expect(session.userId).toBe(context.user!.id);
    });

    it('Session - uses existing User from context', async () => {
      const userFactory = createFactory('User', {
        defaults: () => ({
          email: `user-${getNextSeq()}@test.com`,
          emailVerified: true,
        }),
      });

      const sessionFactory = createFactory('Session', {
        defaults: () => ({
          token: faker.string.alphanumeric(32),
          expiresAt: new Date(Date.now() + 86400000),
        }),
      });

      // Build user first
      const { entity: user, context } = await userFactory.build();

      // Build session with existing context
      const { entity: session } = await sessionFactory.build(undefined, context);

      expect(session.userId).toBe(user.id);
    });

    it('OrganizationUser - auto-creates both User and Organization', async () => {
      createFactory('User', {
        defaults: () => ({
          email: `user-${getNextSeq()}@test.com`,
          emailVerified: true,
        }),
      });

      createFactory('Organization', {
        defaults: () => ({
          name: faker.company.name(),
          slug: `org-${getNextSeq()}`,
        }),
      });

      const orgUserFactory = createFactory('OrganizationUser', {
        defaults: () => ({
          role: OrganizationRole.member,
        }),
      });

      const { entity: orgUser, context } = await orgUserFactory.build();

      expect(orgUser.userId).toBe(context.user!.id);
      expect(orgUser.organizationId).toBe(context.organization!.id);
    });

    it('Token with OrganizationUser - composite FK via ref override', async () => {
      createFactory('User', {
        defaults: () => ({
          email: `user-${getNextSeq()}@test.com`,
          emailVerified: true,
        }),
      });

      createFactory('Organization', {
        defaults: () => ({
          name: faker.company.name(),
          slug: `org-${getNextSeq()}`,
        }),
      });

      createFactory('OrganizationUser', {
        defaults: () => ({
          role: OrganizationRole.member,
        }),
      });

      const tokenFactory = createFactory('Token', {
        defaults: () => ({
          name: 'Test Token',
          keyHash: faker.string.alphanumeric(64),
          keyPrefix: faker.string.alphanumeric(16),
          ownerModel: 'OrganizationUser' as const,
          role: OrganizationRole.member,
          isActive: true,
        }),
        dependencies: {
          organizationUser: {
            modelName: 'OrganizationUser',
            foreignKey: ['organizationId', 'userId'],
            required: false,
          },
        },
      });

      // Pass organizationUser: {} to trigger creation
      const { entity: token, context } = await tokenFactory.build({
        organizationUser: {},
      });

      // Token should have both FKs from the created OrganizationUser
      expect(context.organizationUser).toBeDefined();
      expect(token.userId).toBe(context.organizationUser!.userId);
      expect(token.organizationId).toBe(context.organizationUser!.organizationId);
      // OrganizationUser should have created User and Organization
      expect(context.user).toBeDefined();
      expect(context.organization).toBeDefined();
    });
  });

  describe('sequence', () => {
    it('getNextSeq increments', () => {
      const first = getNextSeq();
      expect(getNextSeq()).toBe(first + 1);
      expect(getNextSeq()).toBe(first + 2);
    });

    it('resetSequence resets to baseline', () => {
      resetSequence();
      const baseline = getNextSeq();
      getNextSeq();
      getNextSeq();
      resetSequence();
      expect(getNextSeq()).toBe(baseline);
    });
  });
});
