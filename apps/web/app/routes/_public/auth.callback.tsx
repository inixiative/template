import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { fetchAndHydrateMe } from '@template/ui/lib/auth/fetchAndHydrateMe';
import { setToken } from '@template/ui/lib/auth/token';
import { useAppStore } from '@template/ui/store';
import { useEffect } from 'react';

export const Route = createFileRoute('/_public/auth/callback')({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const completeOAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const token = url.searchParams.get('token') || url.hash.match(/token=([^&]+)/)?.[1];

        if (!token) {
          throw new Error('No authentication token received');
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        setToken(token, expiresAt);

        await fetchAndHydrateMe(useAppStore.setState, useAppStore.getState);

        const redirectTo = localStorage.getItem('authRedirectTo') || '/dashboard';
        localStorage.removeItem('authRedirectTo');

        navigate({ to: redirectTo });
      } catch (error) {
        console.error('OAuth callback failed:', error);
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
}
