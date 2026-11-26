/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { useQuery } from '@tanstack/react-query';
import {
  type SpaceUpdateData,
  spaceProtected,
  spaceProtectedQueryKey,
  spaceUpdate,
} from '@template/sdk';
import { Page, Skeleton } from '@template/ui/components';
import { ProfileFormCard, ResourceSettingsSection } from '@template/ui/components/settings';
import { useOptimisticMutation } from '@template/ui/hooks';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { useEffect, useState } from 'react';

export const SpaceProfilePage = () => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const spaceId = context.space!.id;
  const hasMembership = useAppStore((state) => Boolean(state.auth.spaceUsers?.[spaceId]));
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

  return (
    <Page title="Profile" description="Manage your space settings and preferences">
      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <div className="max-w-2xl space-y-6">
          <ProfileFormCard
            name={name}
            onNameChange={setName}
            slug={slug}
            onSlugChange={setSlug}
            showSlug
            onSave={handleSave}
            isSaving={updateMutation.isPending}
          />
          <ResourceSettingsSection context={context} category="general" />
          {hasMembership ? (
            <ResourceSettingsSection
              context={context}
              ownership={{ ownedByMyMembership: true }}
              category="general"
              title={`Your preferences in ${profile?.name ?? context.space?.name ?? 'this space'}`}
              description="Personal overrides scoped to your membership in this space."
            />
          ) : null}
        </div>
      )}
    </Page>
  );
};
