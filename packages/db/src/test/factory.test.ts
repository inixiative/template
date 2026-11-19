import { beforeEach, describe, expect, it } from 'bun:test';
import {
  buildOrganizationUser,
  buildSession,
  buildToken,
  buildUser,
} from '@template/db/test/factories';
import { nextFactorySequenceNumber, resetSequence } from '@template/db/test/factory';

beforeEach(() => {
  resetSequence();
});

describe('registerFactory', () => {
  describe('build (in-memory)', () => {
    it('User - builds with defaults', async () => {
      const { entity: user, context } = await buildUser();

      expect(user.id).toBeDefined();
      expect(user.email).toMatch(/^user-\d+@/);
      expect(user.emailVerified).toBe(true);
      expect(context.user).toBe(user);
    });

    it('User - builds with overrides', async () => {
      const { entity: user } = await buildUser({ email: 'custom@test.com' });

      expect(user.email).toBe('custom@test.com');
    });

    it('Session - auto-creates User dependency', async () => {
      const { entity: session, context } = await buildSession();

      expect(session.userId).toBeDefined();
      expect(context.user).toBeDefined();
      expect(session.userId).toBe(context.user!.id);
    });

    it('Session - uses existing User from context', async () => {
      const { entity: user, context } = await buildUser();

      const { entity: session } = await buildSession(undefined, context);

      expect(session.userId).toBe(user.id);
    });

    it('OrganizationUser - auto-creates both User and Organization', async () => {
      const { entity: orgUser, context } = await buildOrganizationUser();

      expect(orgUser.userId).toBe(context.user!.id);
      expect(orgUser.organizationId).toBe(context.organization!.id);
    });

    it('Session - uses existing User passed via context', async () => {
      const { entity: user } = await buildUser();

      const { entity: session, context } = await buildSession(undefined, { user });

      expect(session.userId).toBe(user.id);
      expect(context.user).toBe(user);
    });

    it('Token with OrganizationUser - composite FK via ref override', async () => {
      const { entity: token, context } = await buildToken({
        ownerModel: 'OrganizationUser',
        organizationUser: {},
      });

      expect(context.organizationUser).toBeDefined();
      expect(token.userId).toBe(context.organizationUser!.userId);
      expect(token.organizationId).toBe(context.organizationUser!.organizationId);
      expect(context.user).toBeDefined();
      expect(context.organization).toBeDefined();
    });
  });

  describe('sequence', () => {
    it('nextFactorySequenceNumber increments', () => {
      const first = nextFactorySequenceNumber();
      expect(nextFactorySequenceNumber()).toBe(first + 1);
      expect(nextFactorySequenceNumber()).toBe(first + 2);
    });

    it('resetSequence resets to baseline', () => {
      resetSequence();
      const baseline = nextFactorySequenceNumber();
      nextFactorySequenceNumber();
      nextFactorySequenceNumber();
      resetSequence();
      expect(nextFactorySequenceNumber()).toBe(baseline);
    });
  });
});
