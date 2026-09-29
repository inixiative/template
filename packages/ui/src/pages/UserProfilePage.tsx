/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { meRead, meReadQueryKey } from '@template/sdk';
import { Page } from '@template/ui/components';
import { ProfileFormCard } from '@template/ui/components/settings';
import { useQuery } from '@template/ui/hooks';
import { apiQuery } from '@template/ui/lib/apiQuery';

export const UserProfilePage = () => {
  const { data, isLoading } = useQuery({
    queryKey: meReadQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meRead>[0]) => meRead(opts)),
  });

  const profile = data?.data;

  return (
    <Page title="Profile" description="Manage your user settings and preferences">
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
      ) : (
        <ProfileFormCard
          name={profile?.name ?? ''}
          canEditName={false}
          readOnlyMessage="User profile editing coming soon"
          showThemeToggle
        />
      )}
    </Page>
  );
};
