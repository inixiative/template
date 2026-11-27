/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { useQuery } from '@tanstack/react-query';
import {
  type OrganizationUpdateData,
  organizationProtected,
  organizationProtectedQueryKey,
  organizationUpdate,
} from '@template/sdk';
import { Page } from '@template/ui/components';
import { ProfileFormCard } from '@template/ui/components/settings';
import { useOptimisticMutation } from '@template/ui/hooks';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { useEffect, useState } from 'react';

export const OrganizationProfilePage = () => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const organizationId = context.organization!.id;
  const detailQueryKey = organizationProtectedQueryKey({ path: { id: organizationId } });

  const { data, isLoading } = useQuery({
    queryKey: detailQueryKey,
    queryFn: apiQuery((opts: Parameters<typeof organizationProtected>[0]) =>
      organizationProtected({ ...opts, path: { id: organizationId } }),
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
    mutationFn: apiMutation((payload: Omit<OrganizationUpdateData, 'url'>) =>
      organizationUpdate(payload),
    ),
    targets: [
      {
        queryKey: detailQueryKey,
        optimisticUpdate: (old, payload: Omit<OrganizationUpdateData, 'url'>) => {
          const cached = old as { data?: Record<string, unknown> } | undefined;
          if (!cached?.data) return cached;
          return { ...cached, data: { ...cached.data, ...payload.body } };
        },
      },
    ],
  });

  const handleSave = () => {
    updateMutation.mutate({
      path: { id: organizationId },
      body: { name, slug },
    });
  };

  return (
    <Page title="Profile" description="Your organization's name and slug">
      <div className="max-w-2xl space-y-6">
        <ProfileFormCard
          isLoading={isLoading}
          name={name}
          onNameChange={setName}
          slug={slug}
          onSlugChange={setSlug}
          showSlug
          onSave={handleSave}
          isSaving={updateMutation.isPending}
        />
      </div>
    </Page>
  );
};
