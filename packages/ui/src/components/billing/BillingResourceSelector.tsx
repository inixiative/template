/**
 * @atlas
 * @kind component
 * @partOf feature:billing, primitive:ui
 * @uses primitive:sdk
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HydratedRecord } from '@template/db';
import {
  type BillingAccountReadResponse,
  billingResourceCreate,
  billingResourceDelete,
  billingResourceResolve,
} from '@template/sdk';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
} from '@template/ui/components/primitives';
import { useAppStore } from '@template/ui/store';
import { useMemo, useState } from 'react';

type BillingAccountOption = Pick<BillingAccountReadResponse['data'], 'id' | 'name' | 'status'>;

export type BillingResourceSelectorTarget =
  | { resourceModel: 'Space'; id: string; resourceOrganizationId: string; resourceSpaceId: string }
  | {
      resourceModel: 'OrganizationUser';
      id: string;
      resourceOrganizationId: string;
      resourceUserId: string;
    }
  | {
      resourceModel: 'SpaceUser';
      id: string;
      resourceOrganizationId: string;
      resourceSpaceId: string;
      resourceUserId: string;
    }
  | { resourceModel: 'Project'; id: string; resourceProjectId: string }
  | { resourceModel: 'ProjectIntegration'; id: string; resourceProjectIntegrationId: string };

export type BillingResourceSelectorProps = {
  target: BillingResourceSelectorTarget;
  availableAccounts: readonly BillingAccountOption[];
  canManage?: boolean;
  title?: string;
};

export const BillingResourceSelector = ({
  target,
  availableAccounts,
  canManage,
  title = 'Billing Assignment',
}: BillingResourceSelectorProps) => {
  const queryClient = useQueryClient();
  const permissions = useAppStore((s) => s.permissions);
  const authUser = useAppStore((s) => s.auth.user);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isManageable = useMemo(() => {
    if (canManage !== undefined) return canManage;
    switch (target.resourceModel) {
      case 'Space':
        return permissions.check(
          'space',
          { id: target.resourceSpaceId } as HydratedRecord,
          'manage',
        );
      case 'OrganizationUser':
        return permissions.check(
          'organizationUser',
          {
            id: target.id,
            organizationId: target.resourceOrganizationId,
            userId: target.resourceUserId,
            user: authUser ? { id: authUser.id } : undefined,
          } as HydratedRecord,
          'operate',
        );
      case 'SpaceUser':
        return permissions.check(
          'spaceUser',
          {
            id: target.id,
            organizationId: target.resourceOrganizationId,
            spaceId: target.resourceSpaceId,
            userId: target.resourceUserId,
            user: authUser ? { id: authUser.id } : undefined,
          } as HydratedRecord,
          'operate',
        );
      case 'Project':
        return permissions.check(
          'project',
          { id: target.resourceProjectId } as HydratedRecord,
          'manage',
        );
      case 'ProjectIntegration':
        return permissions.check(
          'projectIntegration',
          { id: target.resourceProjectIntegrationId } as HydratedRecord,
          'manage',
        );
    }
  }, [canManage, target, permissions, authUser]);

  const resolveQueryKey = ['billingResource', 'resolve', target.resourceModel, target.id];
  const resolveQuery = useQuery({
    queryKey: resolveQueryKey,
    queryFn: async () => {
      const res = await billingResourceResolve({
        query: { targetModel: target.resourceModel, id: target.id },
        throwOnError: true,
      });
      return res.data.data;
    },
  });

  const bindMutation = useMutation({
    mutationFn: async (billingAccountId: string) => {
      const body =
        target.resourceModel === 'Space'
          ? {
              billingAccountId,
              replaceExisting: true,
              resourceModel: 'Space' as const,
              resourceOrganizationId: target.resourceOrganizationId,
              resourceSpaceId: target.resourceSpaceId,
            }
          : target.resourceModel === 'OrganizationUser'
            ? {
                billingAccountId,
                replaceExisting: true,
                resourceModel: 'OrganizationUser' as const,
                resourceOrganizationId: target.resourceOrganizationId,
                resourceUserId: target.resourceUserId,
              }
            : target.resourceModel === 'SpaceUser'
              ? {
                  billingAccountId,
                  replaceExisting: true,
                  resourceModel: 'SpaceUser' as const,
                  resourceOrganizationId: target.resourceOrganizationId,
                  resourceSpaceId: target.resourceSpaceId,
                  resourceUserId: target.resourceUserId,
                }
              : target.resourceModel === 'Project'
                ? {
                    billingAccountId,
                    replaceExisting: true,
                    resourceModel: 'Project' as const,
                    resourceProjectId: target.resourceProjectId,
                  }
                : {
                    billingAccountId,
                    replaceExisting: true,
                    resourceModel: 'ProjectIntegration' as const,
                    resourceProjectIntegrationId: target.resourceProjectIntegrationId,
                  };

      await billingResourceCreate({
        body,
        throwOnError: true,
      });
    },
    onSuccess: () => {
      setErrorMessage(null);
      setSelectedAccountId('');
      queryClient.invalidateQueries({ queryKey: resolveQueryKey });
    },
    onError: (err) =>
      setErrorMessage(err instanceof Error ? err.message : 'Failed to assign billing account'),
  });

  const unbindMutation = useMutation({
    mutationFn: async (billingResourceId: string) => {
      await billingResourceDelete({ path: { id: billingResourceId }, throwOnError: true });
    },
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: resolveQueryKey });
    },
    onError: (err) =>
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove billing override'),
  });

  const resolved = resolveQuery.data;
  const directOverrideId =
    resolved?.resolved &&
    resolved.source === 'binding' &&
    resolved.boundAt === target.resourceModel &&
    resolved.billingResourceId
      ? resolved.billingResourceId
      : null;

  const accountOptions = useMemo(
    () => [
      { value: '', label: 'Choose billing account…' },
      ...availableAccounts.map((account) => ({
        value: account.id,
        label: `${account.name} (${account.status})`,
      })),
    ],
    [availableAccounts],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {resolveQuery.isLoading
            ? 'Loading billing assignment…'
            : resolveQuery.isError
              ? 'Failed to load billing assignment.'
              : resolved?.resolved
                ? `Billed via ${resolved.source === 'binding' ? `explicit override (${resolved.boundAt})` : `default (${resolved.boundAt})`}`
                : 'No active billing account resolved.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        {resolved?.resolved && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span>{resolved.billingAccount?.name ?? 'Private billing account'}</span>
              {resolved.status && <Badge variant="secondary">{resolved.status}</Badge>}
            </div>
            {isManageable && directOverrideId && (
              <Button
                size="sm"
                variant="outline"
                disabled={unbindMutation.isPending}
                onClick={() => unbindMutation.mutate(directOverrideId)}
              >
                Remove Override
              </Button>
            )}
          </div>
        )}
        {isManageable && availableAccounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Select billing account"
              className="h-9 w-auto"
              options={accountOptions}
              value={selectedAccountId}
              onChange={setSelectedAccountId}
            />
            <Button
              size="sm"
              disabled={!selectedAccountId || bindMutation.isPending}
              onClick={() => bindMutation.mutate(selectedAccountId)}
            >
              Assign Account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
