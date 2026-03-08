import { meRead, meReadQueryKey } from '@template/ui/apiClient';
import { DetailPanel, MasterDetailLayout } from '@template/ui/components/layout';
import { ProfileFormCard } from '@template/ui/components/settings';
import { useQuery } from '@template/ui/hooks';
import { apiQuery } from '@template/ui/lib/apiQuery';

export const UserProfilePage = () => {
  const { data, isLoading } = useQuery({
    queryKey: meReadQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meRead>[0]) => meRead(opts)),
  });

  const profile = data?.data;

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <MasterDetailLayout
      detail={
        <DetailPanel
          header={
            <div className="px-6 py-4 border-b">
              <h1 className="text-2xl font-bold">Profile</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage your user settings and preferences</p>
            </div>
          }
        >
          <div className="p-6">
            <ProfileFormCard
              name={profile?.name ?? ''}
              canEditName={false}
              readOnlyMessage="User profile editing coming soon"
              showThemeToggle
            />
          </div>
        </DetailPanel>
      }
    />
  );
};
