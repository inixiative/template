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
      expect(user.email).toBe('user-1@test.com');
      expect(user.emailVerified).toBe(true);
      expect(context.User).toBe(user);
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
      expect(context.User).toBeDefined();
      expect(session.userId).toBe(context.User?.id);
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

      expect(orgUser.userId).toBe(context.User?.id);
      expect(orgUser.organizationId).toBe(context.Organization?.id);
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
      expect(context.OrganizationUser).toBeDefined();
      expect(token.userId).toBe(context.OrganizationUser?.userId);
      expect(token.organizationId).toBe(context.OrganizationUser?.organizationId);
      // OrganizationUser should have created User and Organization
      expect(context.User).toBeDefined();
      expect(context.Organization).toBeDefined();
    });
  });

  describe('sequence', () => {
    it('getNextSeq increments', () => {
      expect(getNextSeq()).toBe(1);
      expect(getNextSeq()).toBe(2);
      expect(getNextSeq()).toBe(3);
    });

    it('resetSequence resets to 0', () => {
      getNextSeq();
      getNextSeq();
      resetSequence();
      expect(getNextSeq()).toBe(1);
    });
  });
});
