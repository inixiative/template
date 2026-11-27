/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

import { AuthNoticeCard } from '@template/ui/components/auth/AuthNoticeCard';
import { FormErrorAlert } from '@template/ui/components/auth/FormErrorAlert';
import { Button } from '@template/ui/components/primitives/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives/Card';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';
import { type DescribedError, describeError } from '@template/ui/lib/describeError';
import { useAppStore } from '@template/ui/store';
import { type FormEvent, useState } from 'react';

export type ForgotPasswordFormProps = {
  onLoginClick?: () => void;
};

export const ForgotPasswordForm = ({ onLoginClick }: ForgotPasswordFormProps) => {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<DescribedError>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(undefined);
    setIsSubmitting(true);
    try {
      await useAppStore.getState().auth.requestPasswordReset(email);
      setSentTo(email);
    } catch (err) {
      setError(describeError(err, 'Could not send the reset email. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <AuthNoticeCard
        title="Check your email"
        description={`If an account exists for ${sentTo}, a link to reset its password is on its way. The link works for one hour.`}
        role="status"
        actionLabel="Back to log in"
        onAction={onLoginClick}
      />
    );
  }

  return (
    <Card className="w-full shadow-lg border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we will send you a link to set a new one
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <FormErrorAlert message={error.message} />}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending link...' : 'Send reset link'}
          </Button>

          {onLoginClick && (
            <div className="text-center text-sm text-muted-foreground">
              Remembered it?{' '}
              <button type="button" onClick={onLoginClick} className="text-primary hover:underline">
                Log in
              </button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
