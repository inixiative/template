/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { useSearch } from '@tanstack/react-router';
import { AuthCard } from '@template/ui/components/auth/AuthCard';
import { AuthNoticeCard } from '@template/ui/components/auth/AuthNoticeCard';
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

export type SignUpFormProps = {
  onLoginClick: () => void;
};

export const SignUpForm = ({ onLoginClick }: SignUpFormProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<DescribedError>();
  const [isLoading, setIsLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string>();

  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const signUp = useAppStore((state) => state.auth.signUp);
  const { providers, isLoading: _isLoadingProviders, error: providerError } = useAuthProviders();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      const result = await signUp({ type: 'email', email, password, name });
      setPassword('');
      if (result.status === 'verification-pending') setVerificationEmail(result.email);
      else if (result.status === 'authenticated')
        redirectAfterLogin(useAppStore.getState, search.redirectTo);
    } catch (err) {
      const described = describeError(err, 'Sign up failed. Please try again.');
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
      await signUp({
        type: 'oauth',
        provider,
        callbackURL: `${window.location.origin}/auth/callback`,
      });
    } catch (err) {
      const described = describeError(err, 'Sign up failed. Please try again.');
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
        'Unable to load authentication providers. You can still sign up with email and password.',
      )
    : error;

  if (verificationEmail) {
    return (
      <AuthNoticeCard
        title="Check your email"
        description={`Open the verification link sent to ${verificationEmail}, then log in to continue.`}
        descriptionRole="status"
        actionLabel="Back to log in"
        onAction={onLoginClick}
      />
    );
  }

  return (
    <AuthCard
      title="Create account"
      description={
        showProviders ? 'Choose your sign-up method' : 'Enter your details to get started'
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
                    disabled={isLoading}
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
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button type="button" onClick={onLoginClick} className="text-primary hover:underline">
              Log In
            </button>
          </div>
        </form>
      </div>
    </AuthCard>
  );
};
