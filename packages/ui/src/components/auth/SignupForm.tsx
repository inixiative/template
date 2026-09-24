/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@template/ui/components/primitives/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@template/ui/components/primitives/Card';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';
import { useAuthProviders } from '@template/ui/hooks';
import { type DescribedError, describeError } from '@template/ui/lib/describeError';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';
import { useState } from 'react';

const providerIcons: Record<string, string> = {
  google: 'simple-icons:google',
  github: 'simple-icons:github',
  saml: 'lucide:shield',
};

export type SignupFormProps = {
  onLoginClick?: () => void;
};

export const SignupForm = ({ onLoginClick }: SignupFormProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<DescribedError>();
  const [isLoading, setIsLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string>();

  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const signUp = useAppStore((state) => state.auth.signUp);
  const navigatePreserving = useAppStore((state) => state.navigation.navigatePreserving);
  const { providers, isLoading: _isLoadingProviders, error: providerError } = useAuthProviders();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      const result = await signUp({ type: 'email', email, password, name });
      setPassword('');
      if (result.status === 'verification-pending') setVerificationEmail(result.email);
      else if (result.status === 'authenticated') navigatePreserving(search.redirectTo || '/dashboard', 'context');
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
      <Card className="w-full shadow-lg border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription role="status">
            Open the verification link sent to {verificationEmail}, then log in to continue.
          </CardDescription>
        </CardHeader>
        {onLoginClick && (
          <CardContent>
            <Button type="button" className="w-full" onClick={onLoginClick}>
              Back to log in
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-lg border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>
          {showProviders ? 'Choose your sign-up method' : 'Enter your details to get started'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayError && (
            <div className="bg-error/10 border border-error text-error-foreground rounded-md p-3 text-sm">
              {displayError.message}
              {displayError.detail && <div className="mt-1 text-xs opacity-80 break-all">{displayError.detail}</div>}
            </div>
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
                  <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
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

            {onLoginClick && (
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button type="button" onClick={onLoginClick} className="text-primary hover:underline">
                  Log In
                </button>
              </div>
            )}
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
