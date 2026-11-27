/**
 * @atlas
 * @kind component
 * @partOf feature:project, primitive:ui
 * @uses primitive:sdk, primitive:authz
 */
import { Icon } from '@iconify/react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HydratedRecord } from '@template/db';
import {
  ActionButtonsSkeleton,
  List,
  SkeletonSizedCell,
  SkeletonText,
} from '@template/ui/components';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives';
import { SettingTreeView } from '@template/ui/components/settings/SettingTreeView';
import { hydrateSettingTargetForPermissions } from '@template/ui/lib/hydrateRecordForPermissions';
import {
  connectableIntegrationScopesForProject,
  type IntegrationSummaryRecord,
  type ProjectIntegrationRecord,
  type ProjectRecord,
  projectCreateProjectIntegrationMutationFn,
  projectIntegrationDeleteMutationFn,
  projectReadManyProjectIntegrationsQueryOptions,
} from '@template/ui/lib/projectContextQueries';
import { useAppStore } from '@template/ui/store';
import type * as React from 'react';
import { useMemo, useState } from 'react';

export type ProjectIntegrationResourcesSlotArgs = {
  project: ProjectRecord;
  projectIntegration: ProjectIntegrationRecord;
  integration?: IntegrationSummaryRecord;
};

export type ProjectIntegrationsSectionProps = {
  project: ProjectRecord;
  renderProjectIntegrationResources?: (
    args: ProjectIntegrationResourcesSlotArgs,
  ) => React.ReactNode;
};

// One layout for a connected integration, loaded or skeleton.
const ConnectedIntegrationRow = ({
  name,
  badges,
  actions,
  details,
  testId,
}: {
  name: React.ReactNode;
  badges: React.ReactNode;
  actions: React.ReactNode;
  details?: React.ReactNode;
  testId?: string;
}) => (
  <li className="p-4" data-testid={testId}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {badges}
        </div>
      </div>
      {actions}
    </div>
    {details}
  </li>
);

const connectActionSkeleton = <ActionButtonsSkeleton labels={['Connect']} />;

// One layout for an integration that can be connected, loaded or skeleton; the action keeps a button's height.
const ConnectableIntegrationRow = ({
  name,
  badge,
  action,
}: {
  name: React.ReactNode;
  badge: React.ReactNode;
  action: React.ReactNode;
}) => (
  <li className="flex items-center justify-between gap-3 px-4 py-3">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-medium">{name}</span>
        {badge}
      </div>
    </div>
    <SkeletonSizedCell skeleton={connectActionSkeleton}>{action}</SkeletonSizedCell>
  </li>
);

export const ProjectIntegrationsSection = ({
  project,
  renderProjectIntegrationResources,
}: ProjectIntegrationsSectionProps) => {
  const queryClient = useQueryClient();
  const auth = useAppStore((state) => state.auth);
  const tenantContext = useAppStore((state) => state.tenant.context);
  const permissions = useAppStore((state) => state.permissions);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connectedQueryOpts = useMemo(
    () => projectReadManyProjectIntegrationsQueryOptions(project.id),
    [project.id],
  );
  const connectedQuery = useQuery(connectedQueryOpts);

  const scopes = useMemo(
    () => connectableIntegrationScopesForProject(project, auth),
    [project, auth],
  );

  const scopeQueries = useQueries({
    queries: scopes.map((scope) => ({
      queryKey: scope.queryKey,
      queryFn: scope.queryFn,
      throwOnError: false,
    })),
  });

  const connectedRows = connectedQuery.data?.data ?? [];

  const { integrationsById, connectedIntegrationIds } = useMemo(() => {
    const byId = new Map<string, IntegrationSummaryRecord>();
    for (const query of scopeQueries) {
      for (const integration of query.data?.data ?? []) {
        if (!byId.has(integration.id)) byId.set(integration.id, integration);
      }
    }
    const connectedIds = new Set(connectedRows.map((row) => row.integrationId));
    return { integrationsById: byId, connectedIntegrationIds: connectedIds };
  }, [scopeQueries, connectedRows]);

  const availableGroups = useMemo(() => {
    const seenIds = new Set<string>();
    return scopes.map((scope, index) => {
      const query = scopeQueries[index];
      const rows = (query?.data?.data ?? []).filter((integration) => {
        if (connectedIntegrationIds.has(integration.id)) return false;
        if (seenIds.has(integration.id)) return false;
        seenIds.add(integration.id);
        return true;
      });
      return {
        scope,
        isLoading: Boolean(query?.isLoading),
        integrations: rows,
      };
    });
  }, [scopes, scopeQueries, connectedIntegrationIds]);

  const connectMutation = useMutation({
    throwOnError: false,
    mutationFn: (integrationId: string) =>
      projectCreateProjectIntegrationMutationFn({
        path: { id: project.id },
        body: { integrationId },
      }),
    onSuccess: () => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: connectedQueryOpts.queryKey });
    },
    onError: (err) => {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect integration');
    },
  });

  const disconnectMutation = useMutation({
    throwOnError: false,
    mutationFn: (projectIntegrationId: string) =>
      projectIntegrationDeleteMutationFn({ path: { id: projectIntegrationId } }),
    onSuccess: (_data, disconnectedId) => {
      setErrorMessage(null);
      setExpandedId((current) => (current === disconnectedId ? null : current));
      void queryClient.invalidateQueries({ queryKey: connectedQueryOpts.queryKey });
    },
    onError: (err) => {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to disconnect integration');
    },
  });

  const canConnectIntegration = (integration: IntegrationSummaryRecord): boolean => {
    const hydrated = hydrateSettingTargetForPermissions(
      'ProjectIntegration',
      {
        id: '',
        projectId: project.id,
        integrationId: integration.id,
        project: project as unknown as Record<string, unknown>,
        integration: integration as unknown as Record<string, unknown>,
      },
      auth,
      tenantContext,
    );
    return permissions.check('projectIntegration', hydrated, 'create');
  };

  const canDisconnectProjectIntegration = (
    pi: ProjectIntegrationRecord,
    integration?: IntegrationSummaryRecord,
  ): boolean => {
    const hydrated = hydrateSettingTargetForPermissions(
      'ProjectIntegration',
      {
        ...pi,
        project: project as unknown as Record<string, unknown>,
        ...(integration ? { integration: integration as unknown as Record<string, unknown> } : {}),
      },
      auth,
      tenantContext,
    );
    return permissions.check('projectIntegration', hydrated, 'delete');
  };

  const anyAvailable = availableGroups.some((group) => group.integrations.length > 0);
  const anyScopeLoading = availableGroups.some((group) => group.isLoading);

  const renderConnectableIntegration = (
    integration: (typeof availableGroups)[number]['integrations'][number],
  ) => {
    const canConnect = canConnectIntegration(integration);
    return (
      <ConnectableIntegrationRow
        key={integration.id}
        name={integration.name}
        badge={
          integration.provider ? (
            <Badge variant="outline" className="text-[11px]">
              {integration.provider}
            </Badge>
          ) : null
        }
        action={
          canConnect ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={connectMutation.isPending && connectMutation.variables === integration.id}
              aria-label={`Connect ${integration.name}`}
              onClick={() => connectMutation.mutate(integration.id)}
            >
              <Icon icon="lucide:link" className="mr-1.5 h-4 w-4" />
              Connect
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Read-only</span>
          )
        }
      />
    );
  };

  return (
    <div className="space-y-6" data-testid="project-integrations-section">
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Connected integrations</CardTitle>
          <CardDescription>
            Integrations linked to {project.name}. Expand any integration to configure its
            project-specific settings and resources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <List
            items={connectedRows}
            isLoading={connectedQuery.isLoading}
            emptyMessage="No integrations are connected to this project yet."
            skeletonItem={
              <ConnectedIntegrationRow
                name={<SkeletonText width="10rem" />}
                badges={
                  <Badge variant="outline" className="text-[11px]">
                    provider
                  </Badge>
                }
                actions={<ActionButtonsSkeleton labels={['Settings & resources']} />}
              />
            }
            renderItem={(pi) => {
              const integration = integrationsById.get(pi.integrationId);
              const displayName = integration?.name ?? pi.integrationId;
              const isExpanded = expandedId === pi.id;
              const canDisconnect = canDisconnectProjectIntegration(pi, integration);
              const piRecordForPermissions = {
                ...pi,
                project,
                ...(integration ? { integration } : {}),
              } as unknown as HydratedRecord;

              return (
                <ConnectedIntegrationRow
                  key={pi.id}
                  testId={`connected-project-integration-${pi.id}`}
                  name={displayName}
                  badges={
                    <>
                      {integration?.provider ? (
                        <Badge variant="outline" className="text-[11px]">
                          {integration.provider}
                        </Badge>
                      ) : null}
                      {integration?.ownerModel ? (
                        <Badge variant="secondary" className="text-[11px]">
                          {integration.ownerModel}
                        </Badge>
                      ) : null}
                    </>
                  }
                  actions={
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-expanded={isExpanded}
                        aria-label={`Configure ${displayName}`}
                        onClick={() =>
                          setExpandedId((current) => (current === pi.id ? null : pi.id))
                        }
                      >
                        <Icon icon="lucide:settings-2" className="mr-1.5 h-4 w-4" />
                        {isExpanded ? 'Hide details' : 'Settings & resources'}
                      </Button>
                      {canDisconnect ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            disconnectMutation.isPending && disconnectMutation.variables === pi.id
                          }
                          aria-label={`Disconnect ${displayName}`}
                          onClick={() => disconnectMutation.mutate(pi.id)}
                        >
                          <Icon icon="lucide:unlink" className="mr-1.5 h-4 w-4 text-destructive" />
                          Disconnect
                        </Button>
                      ) : null}
                    </div>
                  }
                  details={
                    isExpanded ? (
                      <div
                        className="mt-4 space-y-4 border-t pt-4"
                        data-testid={`project-integration-details-${pi.id}`}
                      >
                        <SettingTreeView
                          target={{
                            model: 'ProjectIntegration',
                            id: pi.id,
                            record: piRecordForPermissions,
                            integrationProvider: integration?.provider ?? undefined,
                          }}
                          title={`${displayName} settings`}
                        />

                        {renderProjectIntegrationResources ? (
                          <div data-testid={`project-integration-resources-${pi.id}`}>
                            {renderProjectIntegrationResources({
                              project,
                              projectIntegration: pi,
                              integration,
                            })}
                          </div>
                        ) : (
                          <Card data-testid={`project-integration-resources-${pi.id}`}>
                            <CardHeader>
                              <CardTitle className="text-base">Resources</CardTitle>
                              <CardDescription>
                                Integration resources attached to {project.name}.
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground">
                                No resources configured for this integration yet.
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ) : null
                  }
                />
              );
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect integration</CardTitle>
          <CardDescription>
            Choose from integrations available within this project&apos;s scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {anyAvailable ? (
            availableGroups
              .filter((group) => group.integrations.length > 0)
              .map(({ scope, integrations }) => (
                <div
                  key={scope.key}
                  className="space-y-2"
                  data-testid={`connectable-scope-${scope.ownerModel}`}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {scope.label}
                  </h3>
                  <List
                    items={integrations}
                    emptyMessage=""
                    renderItem={renderConnectableIntegration}
                  />
                </div>
              ))
          ) : (
            <List
              items={[]}
              isLoading={anyScopeLoading}
              emptyMessage="No additional integrations are available to connect to this project."
              skeletonItem={
                <ConnectableIntegrationRow
                  name={<SkeletonText width="10rem" />}
                  badge={
                    <Badge variant="outline" className="text-[11px]">
                      provider
                    </Badge>
                  }
                  action={connectActionSkeleton}
                />
              }
              renderItem={renderConnectableIntegration}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
