/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { useNavigate } from '@tanstack/react-router';
import { AuthPageShell } from '@template/ui/components/auth/AuthPageShell';
import { describeError } from '@template/ui/lib/describeError';
import { log } from '@template/ui/lib/logger';
import { redirectAfterLogin } from '@template/ui/lib/routeRedirect';
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

        await useAppStore.getState().auth.completeOAuthSignIn(oneTimeToken);

        const storedRedirect = localStorage.getItem('authRedirectTo') || undefined;
        localStorage.removeItem('authRedirectTo');
        redirectAfterLogin(
          useAppStore.getState,
          storedRedirect,
          storedRedirect ? 'spoof' : 'context',
        );
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
    <AuthPageShell subtitle="Completing sign-in">
      <div className="flex justify-center" role="status" aria-label="Completing sign-in">
        <Icon icon="lucide:loader-2" className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AuthPageShell>
  );
};
