/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { useQuery } from '@tanstack/react-query';
import { meRead, meReadQueryKey } from '@template/sdk';
import { Page } from '@template/ui/components';
import {
  ChangePasswordCard,
  ProfileFormCard,
  TwoFactorSecurityCard,
} from '@template/ui/components/settings';
import { apiQuery } from '@template/ui/lib/apiQuery';

export const UserProfilePage = () => {
  const { data, isLoading } = useQuery({
    queryKey: meReadQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meRead>[0]) => meRead(opts)),
  });

  const profile = data?.data;

  return (
    <Page title="Profile" description="Your profile, password and sign-in security">
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
          <ChangePasswordCard />
          <TwoFactorSecurityCard />
        </div>
      )}
    </Page>
  );
};
