import { zodResolver } from '@hookform/resolvers/zod';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@template/ui/components/primitives/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@template/ui/components/primitives/Card';
import { FormField } from '@template/ui/components/primitives/FormField';
import { Input } from '@template/ui/components/primitives/Input';
import { useAuthProviders } from '@template/ui/hooks';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';
import { Chrome, Github, Key, Shield } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const providerIcons: Record<string, typeof Chrome> = {
  google: Chrome,
  github: Github,
  saml: Shield,
};

export type SignupFormProps = {
  onLoginClick?: () => void;
};

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignupValues = z.infer<typeof signupSchema>;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const SignupForm = ({ onLoginClick }: SignupFormProps) => {
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const signUp = useAppStore((state) => state.auth.signUp);
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);
  const { providers, isLoading: isLoadingProviders, error: providerError } = useAuthProviders();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const handleEmailSignup = async (values: SignupValues) => {
    setError(undefined);
    setIsLoading(true);

    try {
      await signUp({
        type: 'email',
        email: values.email,
        password: values.password,
        name: values.name,
      });
      navigatePreservingContext(search.redirectTo || '/dashboard');
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Sign up failed. Please try again.');
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
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'OAuth sign up failed. Please try again.');
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
                  const Icon = providerIcons[provider.provider.toLowerCase()] || Key;
                  return (
                    <Button
                      key={provider.provider}
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleOAuthClick(provider.provider)}
                      disabled={isLoading || isLoadingProviders}
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

          <form onSubmit={handleSubmit(handleEmailSignup)} className="space-y-4">
            <FormField label="Name" error={errors.name?.message} required>
              <Input type="text" placeholder="Your name" {...register('name')} disabled={isLoading} />
            </FormField>

            <FormField label="Email" error={errors.email?.message} required>
              <Input type="email" placeholder="you@example.com" {...register('email')} disabled={isLoading} />
            </FormField>

            <FormField label="Password" error={errors.password?.message} required>
              <Input
                type="password"
                placeholder="At least 8 characters"
                {...register('password')}
                disabled={isLoading}
              />
            </FormField>

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
