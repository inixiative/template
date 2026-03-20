import { type SpaceUpdateData, spaceProtected, spaceProtectedQueryKey, spaceUpdate } from '@template/ui/apiClient';
import { DetailPanel, MasterDetailLayout } from '@template/ui/components/layout';
import { ProfileFormCard } from '@template/ui/components/settings';
import { useOptimisticMutation, useQuery } from '@template/ui/hooks';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { useEffect, useState } from 'react';

export const SpaceProfilePage = () => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const spaceId = context.space!.id;
  const detailQueryKey = spaceProtectedQueryKey({ path: { id: spaceId } });

  const { data, isLoading } = useQuery({
    queryKey: detailQueryKey,
    queryFn: apiQuery((opts: Parameters<typeof spaceProtected>[0]) =>
      spaceProtected({ ...opts, path: { id: spaceId } }),
    ),
  });

  const profile = data?.data;
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    setName(profile?.name ?? '');
    setSlug(profile?.slug ?? '');
  }, [profile?.name, profile?.slug]);

  const updateMutation = useOptimisticMutation({
    mutationFn: apiMutation((payload: Omit<SpaceUpdateData, 'url'>) => spaceUpdate(payload)),
    targets: [
      {
        queryKey: detailQueryKey,
        optimisticUpdate: (old, payload: Omit<SpaceUpdateData, 'url'>) => {
          const cached = old as { data?: Record<string, unknown> } | undefined;
          if (!cached?.data) return cached;
          return { ...cached, data: { ...cached.data, ...payload.body } };
        },
      },
    ],
  });

  const handleSave = () => {
    updateMutation.mutate({
      path: { id: spaceId },
      body: { name, slug },
    });
  };

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
              <p className="text-sm text-muted-foreground mt-1">Manage your space settings and preferences</p>
            </div>
          }
        >
          <div className="p-6">
            <ProfileFormCard
              name={name}
              onNameChange={setName}
              slug={slug}
              onSlugChange={setSlug}
              showSlug
              onSave={handleSave}
              isSaving={updateMutation.isPending}
            />
          </div>
        </DetailPanel>
      }
    />
  );
};
