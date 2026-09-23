/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useNavigate } from '@tanstack/react-router';
import { fetchAndHydrateMe } from '@template/ui/lib/auth/fetchAndHydrateMe';
import { completeOAuthSignIn } from '@template/ui/lib/auth/signin';
import { log } from '@template/ui/lib/logger';
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

        await fetchAndHydrateMe(useAppStore.setState, useAppStore.getState);

        const redirectTo = localStorage.getItem('authRedirectTo') || '/dashboard';
        localStorage.removeItem('authRedirectTo');

        navigate({ to: redirectTo });
      } catch (error) {
        log.error('OAuth callback failed:', error);
        navigate({
          to: '/login',
          search: { error: error instanceof Error ? error.message : 'Authentication failed' },
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
