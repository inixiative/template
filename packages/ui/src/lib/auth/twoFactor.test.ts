import { describe, expect, it } from 'bun:test';
import {
  TWO_FACTOR_ENROLLMENT_REQUIRED_CODE,
  TWO_FACTOR_REVERIFY_REQUIRED_CODE,
  TWO_FACTOR_VERIFICATION_REQUIRED_CODE,
} from '@template/shared/auth/twoFactor';
import { createAuthGuards } from '@template/ui/guards/authGuard';
import {
  reverifyMethodsFromError,
  twoFactorActionFromError,
} from '@template/ui/lib/auth/twoFactor';
import { TWO_FACTOR_SETUP_PATH } from '@template/ui/lib/routeRedirect';

describe('frontend two-factor helpers', () => {
  it('extracts re-verification methods from 403 details', () => {
    expect(
      reverifyMethodsFromError({
        details: [
          { code: TWO_FACTOR_REVERIFY_REQUIRED_CODE, methods: ['passkey', 'totp', 'nope'] },
        ],
      }),
    ).toEqual(['passkey', 'totp']);
    expect(reverifyMethodsFromError({ details: [{ code: 'OTHER' }] })).toBeNull();
    expect(reverifyMethodsFromError(null)).toBeNull();
  });

  it('extracts 2FA session redirect actions and guards authenticated routes to /settings/profile', async () => {
    expect(
      twoFactorActionFromError({ details: [{ code: TWO_FACTOR_ENROLLMENT_REQUIRED_CODE }] }),
    ).toBe('enroll');
    expect(
      twoFactorActionFromError({ details: [{ code: TWO_FACTOR_VERIFICATION_REQUIRED_CODE }] }),
    ).toBe('verify');
    expect(
      twoFactorActionFromError({ details: [{ code: TWO_FACTOR_REVERIFY_REQUIRED_CODE }] }),
    ).toBeNull();

    const makeGuard = (twoFactorAction: 'enroll' | 'verify' | null) =>
      createAuthGuards(
        () =>
          ({
            auth: {
              initialize: async () => {},
              isAuthenticated: true,
              twoFactorAction,
            },
          }) as never,
      );

    await expect(
      makeGuard('enroll').redirectToLoginUnlessAuthenticated({
        location: { pathname: '/integrations', search: { tab: 'github' }, hash: '' },
      }),
    ).rejects.toMatchObject({
      options: {
        to: TWO_FACTOR_SETUP_PATH,
        search: { redirectTo: '/integrations?tab=github' },
      },
    });

    await expect(
      makeGuard('verify').redirectToLoginUnlessAuthenticated({
        location: { pathname: TWO_FACTOR_SETUP_PATH, search: {}, hash: '' },
      }),
    ).resolves.toBeUndefined();
  });
});
