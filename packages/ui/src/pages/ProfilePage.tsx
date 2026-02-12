import {
  meRead,
  meReadQueryKey,
  organizationProtected,
  organizationProtectedQueryKey,
  organizationUpdate,
  spaceProtected,
  spaceProtectedQueryKey,
  spaceUpdate,
  type OrganizationUpdateData,
  type SpaceUpdateData,
} from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { MasterDetailLayout, DetailPanel } from '@template/ui/components/layout';
import { useQuery } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, ThemeToggle } from '@template/ui/components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export const ProfilePage = () => {
  const context = useAppStore((state) => state.tenant.context);
  const contextId = context.space?.id || context.organization?.id;
  const queryClient = useQueryClient();

  const endpoints = {
    user: {
      queryKey: meReadQueryKey(),
      queryFn: apiQuery((opts: Parameters<typeof meRead>[0]) => meRead(opts)),
      updateFn: null, // User profile update not implemented yet
    },
    organization: {
      queryKey: organizationProtectedQueryKey({ path: { id: contextId! } }),
      queryFn: apiQuery((opts: Parameters<typeof organizationProtected>[0]) =>
        organizationProtected({ ...opts, path: { id: contextId! } })),
      updateFn: organizationUpdate,
    },
    space: {
      queryKey: spaceProtectedQueryKey({ path: { id: contextId! } }),
      queryFn: apiQuery((opts: Parameters<typeof spaceProtected>[0]) =>
        spaceProtected({ ...opts, path: { id: contextId! } })),
      updateFn: spaceUpdate,
    },
  }[context.type];

  const { data, isLoading } = useQuery({
    queryKey: endpoints.queryKey,
    queryFn: endpoints.queryFn,
    enabled: context.type === 'user' || !!contextId,
  });

  const profile = data?.data;

  const [name, setName] = useState(profile?.name || '');
  const [slug, setSlug] = useState(profile?.slug || '');

  const updateMutation = useMutation({
    mutationFn: apiMutation((data: OrganizationUpdateData | SpaceUpdateData) =>
      endpoints.updateFn!(data as any)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpoints.queryKey });
    },
  });

  const handleSave = () => {
    if (!endpoints.updateFn) return;

    const payload = {
      path: { id: contextId! },
      body: { name, slug },
    };
    updateMutation.mutate(payload as any);
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
              <p className="text-sm text-muted-foreground mt-1">
                Manage your {context.type} settings and preferences
              </p>
            </div>
          }
        >
          <div className="p-6 max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    disabled={context.type === 'user'}
                  />
                </div>
                {context.type !== 'user' && (
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="slug"
                    />
                  </div>
                )}
                {endpoints.updateFn && (
                  <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
                {context.type === 'user' && (
                  <p className="text-sm text-muted-foreground">
                    User profile editing coming soon
                  </p>
                )}
              </CardContent>
            </Card>

            {context.type === 'user' && (
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ThemeToggle />
                </CardContent>
              </Card>
            )}
          </div>
        </DetailPanel>
      }
    />
  );
};
