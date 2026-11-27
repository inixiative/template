/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  navigateToForgotPassword,
  navigateToLogin,
  navigateToSignUp,
} from '@template/ui/lib/routeRedirect';
import type { AppStore } from '@template/ui/store/types';

const storeRecordingNavigation = () => {
  const navigateKeepingSearchParams = mock((_to: string, _keep: string) => {});
  const currentAppStore = () =>
    ({ navigation: { navigateKeepingSearchParams } }) as unknown as AppStore;
  return { currentAppStore, navigateKeepingSearchParams };
};

const { happyDOM } = window as unknown as { happyDOM: { setURL: (url: string) => void } };
const urlBeforeTests = window.location.href;
const visit = (path: string) => happyDOM.setURL(`http://localhost${path}`);

afterEach(() => happyDOM.setURL(urlBeforeTests));

describe('navigating between auth pages', () => {
  test('carries redirectTo but not the reset link token or error', () => {
    visit('/resetPassword?token=used-token&error=INVALID_TOKEN&redirectTo=%2Fsettings');
    const { currentAppStore, navigateKeepingSearchParams } = storeRecordingNavigation();

    navigateToLogin(currentAppStore, true);
    navigateToForgotPassword(currentAppStore, true);
    navigateToSignUp(currentAppStore, true);

    expect(navigateKeepingSearchParams.mock.calls).toEqual([
      ['/login?redirectTo=%2Fsettings', 'context'],
      ['/forgotPassword?redirectTo=%2Fsettings', 'context'],
      ['/signup?redirectTo=%2Fsettings', 'context'],
    ]);
  });

  test('with nothing to carry, goes to the bare auth page', () => {
    visit('/resetPassword?token=used-token');
    const { currentAppStore, navigateKeepingSearchParams } = storeRecordingNavigation();

    navigateToLogin(currentAppStore, true);

    expect(navigateKeepingSearchParams.mock.calls).toEqual([['/login', 'context']]);
  });

  test('from an app page, returns to that page after login', () => {
    visit('/settings/tokens?org=org-1');
    const { currentAppStore, navigateKeepingSearchParams } = storeRecordingNavigation();

    navigateToLogin(currentAppStore);

    expect(navigateKeepingSearchParams.mock.calls).toEqual([
      ['/login?redirectTo=%2Fsettings%2Ftokens%3Forg%3Dorg-1', 'context'],
    ]);
  });
});
