/**
 * @atlas
 * @kind component
 * @partOf feature:project, primitive:ui
 * @uses primitive:sdk, primitive:authz
 */
import { Icon } from '@iconify/react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HydratedRecord } from '@template/db';
import { List, ListRow, SkeletonSized, SkeletonText } from '@template/ui/components';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives';
import { ResourceSettingsSection } from '@template/ui/components/settings/ResourceSettingsSection';
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

const IntegrationBadges = ({
  provider,
  ownerModel,
}: {
  provider?: string | null;
  ownerModel?: string | null;
}) => (
  <>
    {provider ? (
      <Badge variant="outline" className="text-[11px]">
        {provider}
      </Badge>
    ) : null}
    {ownerModel ? (
      <Badge variant="secondary" className="text-[11px]">
        {ownerModel}
      </Badge>
    ) : null}
  </>
);

const ConnectedIntegrationActions = ({
  displayName,
  isExpanded = false,
  canDisconnect = true,
  isDisconnecting = false,
  onToggleDetails,
  onDisconnect,
}: {
  displayName?: string;
  isExpanded?: boolean;
  canDisconnect?: boolean;
  isDisconnecting?: boolean;
  onToggleDetails?: () => void;
  onDisconnect?: () => void;
}) => (
  <div className="flex items-center gap-2">
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-expanded={isExpanded}
      aria-label={displayName ? `Configure ${displayName}` : undefined}
      onClick={onToggleDetails}
    >
      <Icon icon="lucide:settings-2" className="mr-1.5 h-4 w-4" />
      {isExpanded ? 'Hide details' : 'Settings & resources'}
    </Button>
    {canDisconnect ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isDisconnecting}
        aria-label={displayName ? `Disconnect ${displayName}` : undefined}
        onClick={onDisconnect}
      >
        <Icon icon="lucide:unlink" className="mr-1.5 h-4 w-4 text-destructive" />
        Disconnect
      </Button>
    ) : null}
  </div>
);

const ConnectIntegrationButton = ({
  displayName,
  isConnecting = false,
  onConnect,
}: {
  displayName?: string;
  isConnecting?: boolean;
  onConnect?: () => void;
}) => (
  <Button
    type="button"
    variant="outline"
    size="sm"
    disabled={isConnecting}
    aria-label={displayName ? `Connect ${displayName}` : undefined}
    onClick={onConnect}
  >
    <Icon icon="lucide:link" className="mr-1.5 h-4 w-4" />
    Connect
  </Button>
);

const connectIntegrationButtonSkeleton = <ConnectIntegrationButton />;

const connectedIntegrationSkeletonItem = (
  <ListRow
    name={<SkeletonText width="10rem" />}
    badges={<IntegrationBadges provider="provider" ownerModel="organization" />}
    actions={<ConnectedIntegrationActions />}
  />
);

const connectableIntegrationSkeletonItem = (
  <ListRow
    name={<SkeletonText width="10rem" />}
    badges={<IntegrationBadges provider="provider" />}
    actions={connectIntegrationButtonSkeleton}
  />
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

  const shownGroups = availableGroups.filter(
    (group) => group.isLoading || group.integrations.length > 0,
  );

  const renderConnectableIntegration = (
    integration: (typeof availableGroups)[number]['integrations'][number],
  ) => (
    <ListRow
      key={integration.id}
      name={integration.name}
      badges={<IntegrationBadges provider={integration.provider} />}
      actions={
        <SkeletonSized skeleton={connectIntegrationButtonSkeleton}>
          {canConnectIntegration(integration) ? (
            <ConnectIntegrationButton
              displayName={integration.name}
              isConnecting={
                connectMutation.isPending && connectMutation.variables === integration.id
              }
              onConnect={() => connectMutation.mutate(integration.id)}
            />
          ) : (
            <span className="text-xs text-muted-foreground">Read-only</span>
          )}
        </SkeletonSized>
      }
    />
  );

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
            skeletonItem={connectedIntegrationSkeletonItem}
            renderItem={(pi) => {
              const integration = integrationsById.get(pi.integrationId);
              const displayName = integration?.name ?? pi.integrationId;
              const isExpanded = expandedId === pi.id;
              const piRecordForPermissions = {
                ...pi,
                project,
                ...(integration ? { integration } : {}),
              } as unknown as HydratedRecord;

              return (
                <ListRow
                  key={pi.id}
                  testId={`connected-project-integration-${pi.id}`}
                  name={displayName}
                  badges={
                    <IntegrationBadges
                      provider={integration?.provider}
                      ownerModel={integration?.ownerModel}
                    />
                  }
                  actions={
                    <ConnectedIntegrationActions
                      displayName={displayName}
                      isExpanded={isExpanded}
                      canDisconnect={canDisconnectProjectIntegration(pi, integration)}
                      isDisconnecting={
                        disconnectMutation.isPending && disconnectMutation.variables === pi.id
                      }
                      onToggleDetails={() =>
                        setExpandedId((current) => (current === pi.id ? null : pi.id))
                      }
                      onDisconnect={() => disconnectMutation.mutate(pi.id)}
                    />
                  }
                  details={
                    isExpanded ? (
                      <div
                        className="mt-4 space-y-4 border-t pt-4"
                        data-testid={`project-integration-details-${pi.id}`}
                      >
                        <ResourceSettingsSection
                          target={{
                            model: 'ProjectIntegration',
                            id: pi.id,
                            record: piRecordForPermissions,
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
          {shownGroups.length > 0 ? (
            shownGroups.map(({ scope, integrations, isLoading }) => (
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
                  isLoading={isLoading}
                  skeletonItem={connectableIntegrationSkeletonItem}
                  renderItem={renderConnectableIntegration}
                />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No additional integrations are available to connect to this project.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
