/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { useSearch } from '@tanstack/react-router';
import { AuthCard } from '@template/ui/components/auth/AuthCard';
import { FormErrorAlert } from '@template/ui/components/auth/FormErrorAlert';
import { Button } from '@template/ui/components/primitives/Button';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';
import { useAuthProviders } from '@template/ui/hooks';
import { type DescribedError, describeError } from '@template/ui/lib/describeError';
import { redirectAfterLogin } from '@template/ui/lib/routeRedirect';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';
import { useState } from 'react';

const providerIcons: Record<string, string> = {
  google: 'simple-icons:google',
  github: 'simple-icons:github',
  saml: 'lucide:shield',
};

export type LoginFormProps = {
  onSignUpClick?: () => void;
  onForgotPasswordClick: () => void;
};

export const LoginForm = ({ onSignUpClick, onForgotPasswordClick }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const search = useSearch({ strict: false }) as { redirectTo?: string; error?: string };
  const [error, setError] = useState<DescribedError | undefined>(() =>
    search.error ? describeError(search.error, 'Log in failed. Please try again.') : undefined,
  );
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useAppStore((state) => state.auth.signIn);
  const { providers, isLoading: isLoadingProviders, error: providerError } = useAuthProviders();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      await signIn({ type: 'email', email, password });
      redirectAfterLogin(useAppStore.getState, search.redirectTo);
    } catch (err) {
      const described = describeError(err, 'Log in failed. Please try again.');
      setError(described);
      toast.error(described.message, { description: described.detail });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthClick = async (provider: string) => {
    setError(undefined);
    setIsLoading(true);

    try {
      const redirectTo = search.redirectTo || '/dashboard';
      localStorage.setItem('authRedirectTo', redirectTo);
      await signIn({
        type: 'oauth',
        provider,
        callbackURL: `${window.location.origin}/auth/callback`,
      });
    } catch (err) {
      const described = describeError(err, 'Log in failed. Please try again.');
      setError(described);
      toast.error(described.message, { description: described.detail });
      setIsLoading(false);
    }
  };

  const enabledProviders = providers?.filter((p) => p.enabled) || [];
  const showProviders = enabledProviders.length > 0;
  const displayError = providerError
    ? describeError(
        providerError,
        'Unable to load authentication providers. You can still log in with email and password.',
      )
    : error;

  return (
    <AuthCard
      title="Log In"
      description={
        showProviders ? 'Choose your sign-in method' : 'Enter your email and password to continue'
      }
    >
      <div className="space-y-4">
        {displayError && (
          <FormErrorAlert message={displayError.message} detail={displayError.detail} />
        )}

        {showProviders && (
          <>
            <div className="space-y-2">
              {enabledProviders.map((provider) => {
                const iconSlug = providerIcons[provider.provider.toLowerCase()] || 'lucide:key';
                return (
                  <Button
                    key={provider.provider}
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOAuthClick(provider.provider)}
                    disabled={isLoading || isLoadingProviders}
                  >
                    <Icon icon={iconSlug} className="h-4 w-4 mr-2" />
                    Continue with {provider.name}
                  </Button>
                );
              })}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                onClick={onForgotPasswordClick}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Log In'}
          </Button>

          {onSignUpClick && (
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onSignUpClick}
                className="text-primary hover:underline"
              >
                Sign Up
              </button>
            </div>
          )}
        </form>
      </div>
    </AuthCard>
  );
};
