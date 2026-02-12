import { useSearch } from '@tanstack/react-router';
import { LoginForm } from '@template/ui/components/auth/LoginForm';
import { useAppStore } from '@template/ui/store';
import { useAuthFlow, useAuthProviders } from '@template/ui/hooks';
import { buildPathWithSearch } from '@template/ui/lib/searchParams';

type LoginPageProps = {
  hideSignup?: boolean;
};

export const LoginPage = ({ hideSignup }: LoginPageProps) => {
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const signIn = useAppStore((state) => state.auth.signIn);
  const { handleAuth, error, isLoading } = useAuthFlow(signIn);
  const { providers, isLoading: isLoadingProviders, error: providerError } = useAuthProviders();
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <LoginForm
        onSubmit={handleAuth}
        onSignupClick={hideSignup ? undefined : () => {
          const signupUrl = buildPathWithSearch('/signup', search.redirectTo ? { redirectTo: search.redirectTo } : undefined);
          navigatePreservingContext(signupUrl);
        }}
        providers={providerError ? [] : providers}
        error={providerError ? 'Unable to load authentication providers. You can still sign in with email and password.' : error}
        isLoading={isLoading || isLoadingProviders}
      />
    </div>
  );
};
