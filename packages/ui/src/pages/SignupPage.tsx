import { useSearch } from '@tanstack/react-router';
import { SignupForm } from '@template/ui/components/auth/SignupForm';
import { useAppStore } from '@template/ui/store';
import { useAuthFlow, useAuthProviders } from '@template/ui/hooks';
import { buildPathWithSearch } from '@template/ui/lib/searchParams';

export const SignupPage = () => {
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const signUp = useAppStore((state) => state.auth.signUp);
  const { handleAuth, error, isLoading } = useAuthFlow(signUp);
  const { providers, isLoading: isLoadingProviders, error: providerError } = useAuthProviders();
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignupForm
        onSubmit={handleAuth}
        onLoginClick={() => {
          const loginUrl = buildPathWithSearch('/login', search.redirectTo ? { redirectTo: search.redirectTo } : undefined);
          navigatePreservingContext(loginUrl);
        }}
        providers={providerError ? [] : providers}
        error={providerError ? 'Unable to load authentication providers. You can still sign up with email and password.' : error}
        isLoading={isLoading || isLoadingProviders}
      />
    </div>
  );
};
