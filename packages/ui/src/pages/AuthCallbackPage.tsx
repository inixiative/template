/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useNavigate } from '@tanstack/react-router';
import { completeOAuthSignIn } from '@template/ui/lib/auth/signIn';
import { describeError } from '@template/ui/lib/describeError';
import { log } from '@template/ui/lib/logger';
import { safeInternalRedirect } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';
import { useEffect, useRef } from 'react';

export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const hasExchangedToken = useRef(false);

  useEffect(() => {
    if (hasExchangedToken.current) return;
    hasExchangedToken.current = true;

    const completeOAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const oneTimeToken = new URLSearchParams(url.hash.slice(1)).get('ott');
        url.hash = '';
        window.history.replaceState({}, '', url.toString());

        if (!oneTimeToken) throw new Error('No authentication token received');

        await completeOAuthSignIn(oneTimeToken);
        await useAppStore.getState().auth.refreshMe();

        const storedRedirect = localStorage.getItem('authRedirectTo') || undefined;
        localStorage.removeItem('authRedirectTo');
        const redirectTo = safeInternalRedirect(storedRedirect);
        useAppStore
          .getState()
          .navigation.navigateKeepingSearchParams(redirectTo, storedRedirect ? 'spoof' : 'context');
      } catch (error) {
        log.error('OAuth callback failed:', error);
        navigate({
          to: '/login',
          search: { error: describeError(error).message },
        });
      }
    };

    completeOAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div>Completing authentication...</div>
    </div>
  );
};
