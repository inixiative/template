import { Button } from '@template/ui/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@template/ui/components/Card';
import { Input } from '@template/ui/components/Input';
import { Label } from '@template/ui/components/Label';
import { Chrome, Github, Shield, Key } from 'lucide-react';
import { useState } from 'react';
import { redirectToOAuthProvider } from '@template/ui/lib';
import type { AuthProvider } from '@template/ui/hooks';
import type { LoginCredentials } from '@template/ui/types';

const providerIcons: Record<string, typeof Chrome> = {
  google: Chrome,
  github: Github,
  saml: Shield,
};

export type LoginFormProps = {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  onSignupClick?: () => void;
  providers?: AuthProvider[];
  error?: string;
  isLoading?: boolean;
};

export const LoginForm = ({ onSubmit, onSignupClick, providers = [], error, isLoading }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ email, password });
  };

  const enabledProviders = providers.filter((p) => p.enabled);
  const showProviders = enabledProviders.length > 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          {showProviders ? 'Choose your sign-in method' : 'Enter your email and password to continue'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="bg-error/10 border border-error text-error-foreground rounded-md p-3 text-sm">{error}</div>
          )}

          {showProviders && (
            <>
              <div className="space-y-2">
                {enabledProviders.map((provider) => {
                  const Icon = providerIcons[provider.provider.toLowerCase()] || Key;
                  return (
                    <Button
                      key={provider.provider}
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => redirectToOAuthProvider(provider)}
                      disabled={isLoading}
                    >
                      <Icon className="h-4 w-4 mr-2" />
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>

            {onSignupClick && (
              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <button type="button" onClick={onSignupClick} className="text-primary hover:underline">
                  Sign up
                </button>
              </div>
            )}
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
