import { Icon } from '@iconify/react';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@template/ui/components/primitives/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@template/ui/components/primitives/Card';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';
import { useAuthProviders } from '@template/ui/hooks';
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
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const signUp = useAppStore((state) => state.auth.signUp);
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);
  const { providers, isLoading: _isLoadingProviders, error: providerError } = useAuthProviders();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      await signUp({ type: 'email', email, password, name });
      navigatePreservingContext(search.redirectTo || '/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      setError(message);
      toast.error(message);
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
      const message = err instanceof Error ? err.message : 'OAuth sign up failed. Please try again.';
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  };

  const enabledProviders = providers?.filter((p) => p.enabled) || [];
  const showProviders = enabledProviders.length > 0;
  const displayError = providerError
    ? 'Unable to load authentication providers. You can still sign up with email and password.'
    : error;

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
              {displayError}
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
