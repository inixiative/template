/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { meTwoFactor, meTwoFactorQueryKey } from '@template/sdk';
import { AuthPageShell } from '@template/ui/components/auth/AuthPageShell';
import { TwoFactorVerifyForm } from '@template/ui/components/auth/TwoFactorVerifyForm';
import { Button } from '@template/ui/components/primitives/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives/Card';
import { TwoFactorSecurityCard } from '@template/ui/components/settings';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { redirectAfterTwoFactor } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';
import { useState } from 'react';

export const TwoFactorPage = () => {
  const queryClient = useQueryClient();
  const twoFactorAction = useAppStore((state) => state.auth.twoFactorAction);
  const applyUpgradedJwt = useAppStore((state) => state.auth.applyUpgradedJwt);
  const setTwoFactorAction = useAppStore((state) => state.auth.setTwoFactorAction);
  const refreshMe = useAppStore((state) => state.auth.refreshMe);
  const logout = useAppStore((state) => state.auth.logout);
  const search = useSearch({ strict: false }) as { redirectTo?: string; mode?: string };
  const [isReturning, setIsReturning] = useState(false);

  const isEnroll = twoFactorAction === 'enroll';
  const isReverify = !twoFactorAction && search.mode === 'reverify';

  const { data: twoFactorData, isLoading: isLoadingTwoFactor } = useQuery({
    queryKey: meTwoFactorQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meTwoFactor>[0]) => meTwoFactor(opts)),
    enabled: !isEnroll,
  });

  const navigateBack = () => {
    redirectAfterTwoFactor(useAppStore.getState, search.redirectTo);
  };

  const returnToOrigin = async () => {
    setIsReturning(true);
    try {
      setTwoFactorAction(null);
      await refreshMe();
      void queryClient.invalidateQueries();
      navigateBack();
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <AuthPageShell
      wide={isEnroll}
      subtitle={
        isEnroll
          ? 'Set up two-factor authentication before continuing'
          : 'Verify your identity to continue to your account'
      }
    >
      {isEnroll ? (
        <TwoFactorSecurityCard onEnrolled={() => void returnToOrigin()} />
      ) : (
        <Card className="w-full shadow-lg border-border/50">
          <CardHeader>
            <CardTitle>Two-factor verification</CardTitle>
            <CardDescription>
              Confirm your identity with a passkey, authenticator app, or backup code.
            </CardDescription>
          </CardHeader>
          <CardContent isLoading={isLoadingTwoFactor || isReturning || !twoFactorData?.data}>
            <TwoFactorVerifyForm
              methods={twoFactorData?.data?.methods ?? []}
              onVerified={(jwt) => {
                applyUpgradedJwt(jwt, false);
                void returnToOrigin();
              }}
              submitLabel="Verify and continue"
            />
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-center gap-2">
        {isReverify && (
          <Button type="button" variant="ghost" size="sm" onClick={navigateBack}>
            Cancel
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    </AuthPageShell>
  );
};
