import { describe, expect, it } from 'bun:test';
import { TWO_FACTOR_REVERIFY_REQUIRED_CODE } from '@template/shared/auth/twoFactor';
import { createAuthGuards } from '@template/ui/guards/authGuard';
import { isTwoFactorReverifyError } from '@template/ui/lib/auth/twoFactor';
import { isOnFlowPath } from '@template/ui/lib/flows/isOnFlowPath';
import { safeInternalRedirect, TWO_FACTOR_PATH } from '@template/ui/lib/routeRedirect';
import type { AppStore } from '@template/ui/store/types';

const makeGuard = (overrides: {
  isAuthenticated?: boolean;
  twoFactorAction?: 'enroll' | 'verify' | null;
}) =>
  createAuthGuards(
    () =>
      ({
        auth: {
          initialize: async () => {},
          isAuthenticated: overrides.isAuthenticated ?? true,
          twoFactorAction: overrides.twoFactorAction ?? null,
        },
      }) as unknown as AppStore,
  );

describe('frontend two-factor helpers', () => {
  it('detects TWO_FACTOR_REVERIFY_REQUIRED error details', () => {
    expect(
      isTwoFactorReverifyError({ details: [{ code: TWO_FACTOR_REVERIFY_REQUIRED_CODE }] }),
    ).toBe(true);
    expect(isTwoFactorReverifyError({ details: [{ code: 'OTHER' }] })).toBe(false);
    expect(isTwoFactorReverifyError(null)).toBe(false);
  });

  it('redirects pre-2FA sessions to /two-factor preserving org, space, spoof, and flow', async () => {
    const guard = makeGuard({ twoFactorAction: 'verify' });

    await expect(
      guard.redirectToLoginUnlessAuthenticated({
        location: {
          pathname: '/settings/tokens',
          search: { org: 'org-1', flow: 'flow-1' },
          hash: '',
        },
      }),
    ).rejects.toMatchObject({
      options: {
        to: TWO_FACTOR_PATH,
        search: {
          redirectTo: '/settings/tokens?org=org-1&flow=flow-1',
          org: 'org-1',
          flow: 'flow-1',
        },
      },
    });
  });

  it('guards /two-factor against unauthenticated or verified sessions, splits query/hash, and allows mode=reverify', async () => {
    const anonGuard = makeGuard({ isAuthenticated: false });
    await expect(
      anonGuard.redirectUnlessTwoFactorRequired({
        location: { pathname: TWO_FACTOR_PATH, search: { flow: 'flow-1' }, hash: '' },
      }),
    ).rejects.toMatchObject({
      options: {
        to: '/login',
        search: { flow: 'flow-1' },
      },
    });

    const verifiedGuard = makeGuard({ isAuthenticated: true, twoFactorAction: null });
    await expect(
      verifiedGuard.redirectUnlessTwoFactorRequired({
        location: {
          pathname: TWO_FACTOR_PATH,
          search: { redirectTo: '/settings/tokens?tab=keys#sec', flow: 'flow-1' },
          hash: '',
        },
      }),
    ).rejects.toMatchObject({
      options: {
        to: '/settings/tokens',
        search: { tab: 'keys', flow: 'flow-1' },
        hash: 'sec',
      },
    });

    // Optional 15-minute re-verification is allowed without locking the session in Zustand
    await expect(
      verifiedGuard.redirectUnlessTwoFactorRequired({
        location: {
          pathname: TWO_FACTOR_PATH,
          search: { mode: 'reverify', redirectTo: '/settings/profile' },
          hash: '',
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('prevents auth-page redirect loops and keeps /two-factor flow-safe', async () => {
    expect(safeInternalRedirect('/two-factor')).toBe('/dashboard');
    expect(safeInternalRedirect('/login')).toBe('/dashboard');
    expect(safeInternalRedirect('/settings/tokens')).toBe('/settings/tokens');

    const verifiedGuard = makeGuard({ isAuthenticated: true, twoFactorAction: null });
    await expect(
      verifiedGuard.redirectAuthenticatedUserAwayFromPublicPage({
        location: {
          pathname: '/login',
          search: { redirectTo: '/login', flow: 'flow-1' },
          hash: '',
        },
      }),
    ).rejects.toMatchObject({
      options: {
        to: '/dashboard',
        search: { flow: 'flow-1' },
      },
    });

    expect(
      isOnFlowPath(TWO_FACTOR_PATH, {
        id: 'flow-1',
        returnUrl: '/dashboard',
        steps: [],
      } as unknown as Parameters<typeof isOnFlowPath>[1]),
    ).toBe(true);
  });
});
