/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk, primitive:authz
 */
import { Icon } from '@iconify/react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  MeCreateIntegrationData,
  MeReadManyIntegrationsResponse,
  OrganizationReadManyIntegrationsResponse,
  SpaceReadManyIntegrationsResponse,
} from '@template/sdk';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Page,
} from '@template/ui/components';
import { CreateIntegrationModal } from '@template/ui/components/settings/CreateIntegrationModal';
import {
  createOptimisticListTarget,
  useInfiniteDataQuery,
  useInfiniteScrollTrigger,
  useOptimisticMutation,
} from '@template/ui/hooks';
import { getContextParams } from '@template/ui/lib/getContextParams';
import {
  type IntegrationListQuery,
  type IntegrationOwnerScope,
  integrationContextQueries,
} from '@template/ui/lib/integrationContextQueries';
import {
  customIntegration,
  type IntegrationProvider,
  integrationProviders,
  integrationProviderValues,
} from '@template/ui/lib/integrationProviders';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { type ReactNode, useState } from 'react';

type Integration =
  | MeReadManyIntegrationsResponse['data'][number]
  | OrganizationReadManyIntegrationsResponse['data'][number]
  | SpaceReadManyIntegrationsResponse['data'][number];

type ProviderStatus = 'connected' | 'notConnected' | 'disabled';

const statusBadges: Record<
  ProviderStatus,
  { label: string; variant: 'default' | 'outline' | 'secondary' }
> = {
  connected: { label: 'Connected', variant: 'default' },
  notConnected: { label: 'Not connected', variant: 'outline' },
  disabled: { label: 'Disabled', variant: 'secondary' },
};

const BUCKET_PAGE_SIZE = 100;

const bucketQueryFor = (provider: IntegrationProvider | null): IntegrationListQuery => ({
  searchFields: { provider: { equals: provider } },
  pageSize: BUCKET_PAGE_SIZE,
});

export type IntegrationConnectFlowProps = {
  context: AuthenticatedContext;
  scope?: IntegrationOwnerScope;
  onClose: () => void;
  onConnected: () => void;
};

export type IntegrationConnectFlows = Partial<
  Record<IntegrationProvider, (props: IntegrationConnectFlowProps) => ReactNode>
>;

type IntegrationsPageProps = {
  connectFlows?: IntegrationConnectFlows;
};

type IntegrationBucketProps = {
  context: AuthenticatedContext;
  scope?: IntegrationOwnerScope;
  provider: IntegrationProvider | null;
  label: string;
  icon: string;
  actionLabel: string;
  actionAriaLabel: string;
  canAct: boolean;
  showStatus: boolean;
  canManage: boolean;
  onAct: () => void;
  onDelete: (integration: Integration) => void;
};

const IntegrationBucket = ({
  context,
  scope,
  provider,
  label,
  icon,
  actionLabel,
  actionAriaLabel,
  canAct,
  showStatus,
  canManage,
  onAct,
  onDelete,
}: IntegrationBucketProps) => {
  const integrationQueries = integrationContextQueries(context, scope);
  const bucketQuery = bucketQueryFor(provider);

  const bucket = useInfiniteDataQuery<Integration>({
    queryKey: integrationQueries.readManyQueryKey(bucketQuery),
    queryFn: async (pageParam) => {
      const page = pageParam + 1;
      const { data, pagination } = await integrationQueries.readMany({
        query: { ...bucketQuery, page },
      });
      return {
        data,
        total: pagination.total,
        nextPage: page < (pagination.totalPages ?? 0) ? page : undefined,
      };
    },
  });

  const sentinelRef = useInfiniteScrollTrigger({
    onLoadMore: bucket.fetchNextPage,
    hasMore: bucket.hasNextPage,
    isLoading: bucket.isFetchingNextPage,
  });

  const enabled = canAct && !bucket.isError;
  const status =
    statusBadges[(bucket.total ?? 0) > 0 ? 'connected' : enabled ? 'notConnected' : 'disabled'];
  const slug = provider ?? 'custom';

  return (
    <Card data-testid={`provider-${slug}`}>
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <Icon icon={icon} className="h-6 w-6" aria-hidden />
          <span className="font-medium">{label}</span>
          {showStatus && !bucket.isLoading && !bucket.isError && (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!enabled}
          aria-label={actionAriaLabel}
          onClick={onAct}
        >
          <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
          {actionLabel}
        </Button>
      </div>
      {bucket.isError && (
        <p role="alert" className="px-4 pb-3 text-sm text-destructive">
          {label} integrations could not be loaded.
        </p>
      )}
      {bucket.isLoading && <div className="mx-4 mb-4 h-8 animate-pulse rounded-md bg-muted/50" />}
      {bucket.data.length > 0 && (
        <div className="max-h-80 overflow-y-auto border-t" data-testid={`integrations-${slug}`}>
          <ul className="divide-y">
            {bucket.data.map((integration) => (
              <li key={integration.id} className="flex items-center justify-between px-4 py-2">
                <div>
                  <p className="text-sm font-medium">{integration.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(integration.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${integration.name}`}
                    onClick={() => onDelete(integration)}
                  >
                    <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div ref={sentinelRef} aria-hidden="true" />
          {bucket.isFetchingNextPage && (
            <p className="px-4 py-2 text-xs text-muted-foreground">Loading more...</p>
          )}
        </div>
      )}
    </Card>
  );
};

type IntegrationOwnerSectionProps = {
  context: AuthenticatedContext;
  scope?: IntegrationOwnerScope;
  connectFlows: IntegrationConnectFlows;
  sectionKey: string;
  title?: string;
  description?: string;
};

const IntegrationOwnerSection = ({
  context,
  scope,
  connectFlows,
  sectionKey,
  title,
  description,
}: IntegrationOwnerSectionProps) => {
  const [connectingProvider, setConnectingProvider] = useState<
    IntegrationProvider | null | undefined
  >(undefined);
  const queryClient = useQueryClient();
  const permissions = useAppStore((state) => state.permissions);
  const integrationQueries = integrationContextQueries(context, scope);
  const canManage = scope?.member || permissions.check(...getContextParams(context), 'manage');

  const refreshIntegrations = () =>
    queryClient.invalidateQueries({ queryKey: integrationQueries.readManyQueryKey() });

  const bucketQueryKeyFor = (provider: IntegrationProvider | null) =>
    integrationQueries.readManyQueryKey(bucketQueryFor(provider));

  const createMutation = useOptimisticMutation({
    mutationFn: integrationQueries.create.mutationFn,
    targets: (variables) => [
      createOptimisticListTarget<Integration>({
        queryKey: bucketQueryKeyFor(variables?.body.provider ?? null),
        operation: 'create',
      }),
    ],
  });

  const deleteMutation = useOptimisticMutation({
    mutationFn: integrationQueries.delete.mutationFn,
    targets: [...integrationProviderValues, null].map((provider) =>
      createOptimisticListTarget<Integration>({
        queryKey: bucketQueryKeyFor(provider),
        operation: 'delete',
      }),
    ),
  });

  const handleCreate = (body: Pick<MeCreateIntegrationData['body'], 'name' | 'provider'>) => {
    createMutation.mutate({ body });
  };

  const handleDelete = (integration: Integration) =>
    deleteMutation.mutate({ path: { id: integration.id } });

  const canConnect = (provider: IntegrationProvider) =>
    canManage && (Boolean(connectFlows[provider]) || integrationProviders[provider].directConnect);

  const closeConnect = () => setConnectingProvider(undefined);
  const connectFlow = connectingProvider ? connectFlows[connectingProvider] : undefined;

  const buckets = (
    <div className="space-y-3">
      {integrationProviderValues.map((provider) => {
        const { label, icon } = integrationProviders[provider];
        return (
          <IntegrationBucket
            key={provider}
            context={context}
            scope={scope}
            provider={provider}
            label={label}
            icon={icon}
            actionLabel="Connect"
            actionAriaLabel={`Connect ${label}`}
            canAct={canConnect(provider)}
            showStatus
            canManage={canManage}
            onAct={() => setConnectingProvider(provider)}
            onDelete={handleDelete}
          />
        );
      })}
      <IntegrationBucket
        context={context}
        scope={scope}
        provider={null}
        label={customIntegration.label}
        icon={customIntegration.icon}
        actionLabel="Add custom"
        actionAriaLabel="Add custom"
        canAct={canManage}
        showStatus={false}
        canManage={canManage}
        onAct={() => setConnectingProvider(null)}
        onDelete={handleDelete}
      />
    </div>
  );

  return (
    <>
      {title ? (
        <section className="space-y-3" data-testid={`integrations-section-${sectionKey}`}>
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </CardHeader>
            <CardContent>{buckets}</CardContent>
          </Card>
        </section>
      ) : (
        buckets
      )}

      {connectFlow ? (
        connectFlow({
          context,
          scope,
          onClose: closeConnect,
          onConnected: () => {
            closeConnect();
            void refreshIntegrations();
          },
        })
      ) : (
        <CreateIntegrationModal
          provider={connectingProvider}
          onClose={closeConnect}
          onSubmit={handleCreate}
        />
      )}
    </>
  );
};

export const IntegrationsPage = ({ connectFlows = {} }: IntegrationsPageProps) => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const tenant = context.space ?? context.organization;
  const hasMembership = useAppStore((state) =>
    context.space
      ? Boolean(state.auth.spaceUsers?.[context.space.id])
      : context.organization
        ? Boolean(state.auth.organizationUsers?.[context.organization.id])
        : false,
  );

  return (
    <Page title="Integrations" description="Connect the services this workspace works with">
      {tenant ? (
        <div className="space-y-6">
          {hasMembership ? (
            <IntegrationOwnerSection
              context={context}
              scope={{ member: true }}
              connectFlows={connectFlows}
              sectionKey="member"
              title={`Yours in ${tenant.name}`}
              description={`Services connected as you within ${tenant.name}. Only you and its owners see them.`}
            />
          ) : null}
          <IntegrationOwnerSection
            context={context}
            connectFlows={connectFlows}
            sectionKey="tenant"
            title={`${tenant.name}'s integrations`}
            description={`Services connected for all of ${tenant.name}.`}
          />
        </div>
      ) : (
        <IntegrationOwnerSection context={context} connectFlows={connectFlows} sectionKey="user" />
      )}
    </Page>
  );
};
