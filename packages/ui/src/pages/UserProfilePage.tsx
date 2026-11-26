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
  ResourceSettingsSection,
  TwoFactorSecurityCard,
} from '@template/ui/components/settings';
import { apiQuery } from '@template/ui/lib/apiQuery';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';

const personalContext: AuthenticatedContext = { type: 'user' };

export const UserProfilePage = () => {
  const { data, isLoading } = useQuery({
    queryKey: meReadQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meRead>[0]) => meRead(opts)),
  });

  const profile = data?.data;

  return (
    <Page title="Profile" description="Manage your user settings and preferences">
      <div className="max-w-2xl space-y-6">
        <ProfileFormCard
          isLoading={isLoading}
          name={profile?.name ?? ''}
          canEditName={false}
          readOnlyMessage="User profile editing coming soon"
          showThemeSelector
        />
        <ResourceSettingsSection context={personalContext} category="general" />
        <ChangePasswordCard />
        <TwoFactorSecurityCard />
      </div>
    </Page>
  );
};
