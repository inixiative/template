/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { meRead, meReadQueryKey, meTwoFactor, meTwoFactorQueryKey } from '@template/sdk';
import { Page } from '@template/ui/components';
import { TwoFactorVerifyForm } from '@template/ui/components/auth/TwoFactorVerifyForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives/Card';
import {
  ChangePasswordCard,
  ProfileFormCard,
  ResourceSettingsSection,
  TwoFactorSecurityCard,
} from '@template/ui/components/settings';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { safeInternalRedirect } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';

const personalContext: AuthenticatedContext = { type: 'user' };

export const UserProfilePage = () => {
  const queryClient = useQueryClient();
  const twoFactorAction = useAppStore((state) => state.auth.twoFactorAction);
  const applyUpgradedJwt = useAppStore((state) => state.auth.applyUpgradedJwt);
  const setTwoFactorAction = useAppStore((state) => state.auth.setTwoFactorAction);
  const refreshMe = useAppStore((state) => state.auth.refreshMe);
  const navigateKeepingSearchParams = useAppStore(
    (state) => state.navigation.navigateKeepingSearchParams,
  );
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const { data, isLoading } = useQuery({
    queryKey: meReadQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meRead>[0]) => meRead(opts)),
    enabled: !twoFactorAction,
  });
  const { data: twoFactorData, isLoading: isLoadingTwoFactor } = useQuery({
    queryKey: meTwoFactorQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meTwoFactor>[0]) => meTwoFactor(opts)),
    enabled: twoFactorAction === 'verify',
  });

  const returnToOrigin = () => {
    setTwoFactorAction(null);
    void refreshMe();
    void queryClient.invalidateQueries();
    navigateKeepingSearchParams(
      safeInternalRedirect(search.redirectTo),
      search.redirectTo ? 'spoof' : 'context',
    );
  };

  if (twoFactorAction === 'verify') {
    const methods = twoFactorData?.data?.methods ?? [];
    return (
      <Page
        title="Two-factor verification"
        description="Verify your identity before continuing to your account"
      >
        <div className="max-w-2xl">
          {isLoadingTwoFactor || !twoFactorData?.data ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Verify two-factor authentication</CardTitle>
                <CardDescription>
                  Confirm your identity with a passkey, authenticator app, or backup code to
                  continue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TwoFactorVerifyForm
                  methods={methods}
                  onVerified={(jwt) => {
                    applyUpgradedJwt(jwt, false);
                    returnToOrigin();
                  }}
                  submitLabel="Verify and continue"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </Page>
    );
  }

  if (twoFactorAction === 'enroll') {
    return (
      <Page
        title="Set up two-factor authentication"
        description="Two-factor authentication is required before using this app"
      >
        <div className="max-w-2xl space-y-4">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            Set up a passkey or authenticator app below to unlock your session. You will be returned
            automatically once setup finishes.
          </div>
          <TwoFactorSecurityCard onEnrolled={returnToOrigin} />
        </div>
      </Page>
    );
  }

  const profile = data?.data;

  return (
    <Page title="Profile" description="Manage your user settings and preferences">
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
      ) : (
        <div className="max-w-2xl space-y-6">
          <ProfileFormCard
            name={profile?.name ?? ''}
            canEditName={false}
            readOnlyMessage="User profile editing coming soon"
            showThemeSelector
          />
          <ResourceSettingsSection context={personalContext} category="general" />
          <ChangePasswordCard />
          <TwoFactorSecurityCard />
        </div>
      )}
    </Page>
  );
};
