/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk, primitive:authz
 */
import { Icon } from '@iconify/react';
import { useQueryClient } from '@tanstack/react-query';
import type { HydratedRecord, IntegrationOwnerModel } from '@template/db';
import type {
  MeCreateIntegrationData,
  MeReadManyIntegrationsResponse,
  OrganizationReadManyIntegrationsResponse,
  SpaceReadManyIntegrationsResponse,
} from '@template/sdk';
import { settingAppliesToIntegrationProvider } from '@template/shared/settings';
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
import { ResourceSettingsSection } from '@template/ui/components/settings/ResourceSettingsSection';
import {
  createOptimisticListTarget,
  useInfiniteDataQuery,
  useInfiniteScrollTrigger,
  useOptimisticMutation,
  useSectionOpen,
} from '@template/ui/hooks';
import { invalidateUnfinishedActiveFlow } from '@template/ui/lib/flows/invalidateUnfinishedActiveFlow';
import {
  type IntegrationListQuery,
  integrationContextQueries,
} from '@template/ui/lib/integrationContextQueries';
import {
  customIntegration,
  type IntegrationProvider,
  integrationProviders,
  integrationProviderValues,
} from '@template/ui/lib/integrationProviders';
import { useSettingCatalog } from '@template/ui/lib/masterData';
import type { MyMembershipOwnership } from '@template/ui/lib/myMembership';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib/permissionCheckTargetForTenantContext';
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

const PROVIDER_SECTION_PAGE_SIZE = 100;

const integrationListQueryForProvider = (
  provider: IntegrationProvider | null,
): IntegrationListQuery => ({
  searchFields: { provider: { equals: provider } },
  pageSize: PROVIDER_SECTION_PAGE_SIZE,
});

export type IntegrationConnectFlowProps = {
  context: AuthenticatedContext;
  ownership?: MyMembershipOwnership;
  onClose: () => void;
  onConnected: () => void;
};

export type IntegrationConnectFlows = Partial<
  Record<IntegrationProvider, (props: IntegrationConnectFlowProps) => ReactNode>
>;

export type ProviderFitsOwner = (
  provider: IntegrationProvider,
  ownerModel: IntegrationOwnerModel,
) => boolean;

const everyProviderFitsEveryOwner: ProviderFitsOwner = () => true;

type IntegrationsPageProps = {
  connectFlows?: IntegrationConnectFlows;
  providerFitsOwner?: ProviderFitsOwner;
};

type IntegrationProviderSectionProps = {
  context: AuthenticatedContext;
  ownership?: MyMembershipOwnership;
  provider: IntegrationProvider | null;
  label: string;
  icon: string;
  actionLabel: string;
  actionAriaLabel: string;
  canConnect: boolean;
  showStatus: boolean;
  canManage: boolean;
  hasIntegrationSettings: boolean;
  sectionId: string;
  renderConnect: (close: () => void) => ReactNode;
  onDelete: (integration: Integration) => void;
};

const IntegrationProviderSection = ({
  context,
  ownership,
  provider,
  label,
  icon,
  actionLabel,
  actionAriaLabel,
  canConnect,
  showStatus,
  canManage,
  hasIntegrationSettings,
  sectionId,
  renderConnect,
  onDelete,
}: IntegrationProviderSectionProps) => {
  const [isConnectOpen, setConnectOpen] = useSectionOpen(sectionId);
  const [openSettingsIntegrationId, setOpenSettingsIntegrationId] = useState<string | null>(null);
  const integrationQueries = integrationContextQueries(context, ownership);
  const providerListQuery = integrationListQueryForProvider(provider);

  const providerIntegrations = useInfiniteDataQuery<Integration>({
    queryKey: integrationQueries.readManyQueryKey(providerListQuery),
    queryFn: async (pageParam) => {
      const page = pageParam + 1;
      const { data, pagination } = await integrationQueries.readMany({
        query: { ...providerListQuery, page },
      });
      return {
        data,
        total: pagination.total,
        nextPage: page < (pagination.totalPages ?? 0) ? page : undefined,
      };
    },
  });

  const sentinelRef = useInfiniteScrollTrigger({
    onLoadMore: providerIntegrations.fetchNextPage,
    hasMore: providerIntegrations.hasNextPage,
    isLoading: providerIntegrations.isFetchingNextPage,
  });

  const enabled = canConnect && !providerIntegrations.isError;
  const status =
    statusBadges[
      (providerIntegrations.total ?? 0) > 0 ? 'connected' : enabled ? 'notConnected' : 'disabled'
    ];
  const slug = provider ?? 'custom';

  return (
    <Card data-testid={`provider-${slug}`}>
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <Icon icon={icon} className="h-6 w-6" aria-hidden />
          <span className="font-medium">{label}</span>
          {showStatus && !providerIntegrations.isLoading && !providerIntegrations.isError && (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!enabled}
          aria-label={actionAriaLabel}
          onClick={() => setConnectOpen(true)}
        >
          <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
          {actionLabel}
        </Button>
      </div>
      {providerIntegrations.isError && (
        <p role="alert" className="px-4 pb-3 text-sm text-destructive">
          {label} integrations could not be loaded.
        </p>
      )}
      {providerIntegrations.isLoading && (
        <div className="mx-4 mb-4 h-8 animate-pulse rounded-md bg-muted/50" />
      )}
      {providerIntegrations.data.length > 0 && (
        <div className="max-h-80 overflow-y-auto border-t" data-testid={`integrations-${slug}`}>
          <ul className="divide-y">
            {providerIntegrations.data.map((integration) => (
              <li key={integration.id} className="px-4 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(integration.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {hasIntegrationSettings ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Settings for ${integration.name}`}
                        onClick={() =>
                          setOpenSettingsIntegrationId((current) =>
                            current === integration.id ? null : integration.id,
                          )
                        }
                      >
                        <Icon icon="lucide:settings" className="h-4 w-4" />
                      </Button>
                    ) : null}
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
                  </div>
                </div>
                {hasIntegrationSettings && openSettingsIntegrationId === integration.id ? (
                  <div className="mt-3">
                    <ResourceSettingsSection
                      target={{
                        model: 'Integration',
                        id: integration.id,
                        record: integration as unknown as HydratedRecord,
                        integrationProvider: integration.provider ?? undefined,
                      }}
                      title={`${integration.name} settings`}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <div ref={sentinelRef} aria-hidden="true" />
          {providerIntegrations.isFetchingNextPage && (
            <p className="px-4 py-2 text-xs text-muted-foreground">Loading more...</p>
          )}
        </div>
      )}
      {isConnectOpen && enabled && renderConnect(() => setConnectOpen(false))}
    </Card>
  );
};

type IntegrationOwnerSectionProps = {
  context: AuthenticatedContext;
  ownership?: MyMembershipOwnership;
  connectFlows: IntegrationConnectFlows;
  providerFitsOwner: ProviderFitsOwner;
  sectionKey: string;
  title?: string;
  description?: string;
};

const IntegrationOwnerSection = ({
  context,
  ownership,
  connectFlows,
  providerFitsOwner,
  sectionKey,
  title,
  description,
}: IntegrationOwnerSectionProps) => {
  const queryClient = useQueryClient();
  const permissions = useAppStore((state) => state.permissions);
  const { catalog } = useSettingCatalog();
  const hasIntegrationSettings = (provider: IntegrationProvider | null) =>
    Boolean(
      catalog &&
        Object.values(catalog.definitions).some(
          (definition) =>
            definition.resourceModels.includes('Integration') &&
            settingAppliesToIntegrationProvider(definition, provider ?? undefined),
        ),
    );
  const integrationQueries = integrationContextQueries(context, ownership);
  const canManage =
    ownership?.ownedByMyMembership ||
    permissions.check(...permissionCheckTargetForTenantContext(context), 'manage');

  const refreshIntegrations = () =>
    queryClient.invalidateQueries({ queryKey: integrationQueries.readManyQueryKey() });

  const integrationListQueryKeyForProvider = (provider: IntegrationProvider | null) =>
    integrationQueries.readManyQueryKey(integrationListQueryForProvider(provider));

  const createMutation = useOptimisticMutation({
    mutationFn: integrationQueries.create.mutationFn,
    targets: (variables) => [
      createOptimisticListTarget<Integration>({
        queryKey: integrationListQueryKeyForProvider(variables?.body.provider ?? null),
        operation: 'create',
      }),
    ],
  });

  const deleteMutation = useOptimisticMutation({
    mutationFn: integrationQueries.delete.mutationFn,
    targets: [...integrationProviderValues, null].map((provider) =>
      createOptimisticListTarget<Integration>({
        queryKey: integrationListQueryKeyForProvider(provider),
        operation: 'delete',
      }),
    ),
  });

  const handleCreate = (body: Pick<MeCreateIntegrationData['body'], 'name' | 'provider'>) => {
    createMutation.mutate({ body });
  };

  const handleDelete = (integration: Integration) =>
    deleteMutation.mutate({ path: { id: integration.id } });

  const canConnectProvider = (provider: IntegrationProvider) =>
    canManage && (Boolean(connectFlows[provider]) || integrationProviders[provider].directConnect);

  const sectionIdPrefix = sectionKey === 'tenant' || sectionKey === 'user' ? '' : `${sectionKey}-`;

  const renderConnect = (provider: IntegrationProvider | null) => (close: () => void) => {
    const connectFlow = provider ? connectFlows[provider] : undefined;
    if (!connectFlow) {
      return <CreateIntegrationModal provider={provider} onClose={close} onSubmit={handleCreate} />;
    }
    return connectFlow({
      context,
      ownership,
      onClose: close,
      onConnected: () => {
        close();
        void refreshIntegrations();
        invalidateUnfinishedActiveFlow(queryClient);
      },
    });
  };

  const providerSections = (
    <div className="space-y-3">
      {integrationProviderValues
        .filter((provider) => providerFitsOwner(provider, integrationQueries.owner.ownerModel))
        .map((provider) => {
          const { label, icon } = integrationProviders[provider];
          return (
            <IntegrationProviderSection
              key={provider}
              context={context}
              ownership={ownership}
              provider={provider}
              label={label}
              icon={icon}
              actionLabel="Connect"
              actionAriaLabel={`Connect ${label}`}
              canConnect={canConnectProvider(provider)}
              showStatus
              canManage={canManage}
              hasIntegrationSettings={hasIntegrationSettings(provider)}
              sectionId={`${sectionIdPrefix}connect-${provider}`}
              renderConnect={renderConnect(provider)}
              onDelete={handleDelete}
            />
          );
        })}
      <IntegrationProviderSection
        context={context}
        ownership={ownership}
        provider={null}
        label={customIntegration.label}
        icon={customIntegration.icon}
        actionLabel="Add custom"
        actionAriaLabel="Add custom"
        canConnect={canManage}
        showStatus={false}
        canManage={canManage}
        hasIntegrationSettings={hasIntegrationSettings(null)}
        sectionId={`${sectionIdPrefix}add-custom`}
        renderConnect={renderConnect(null)}
        onDelete={handleDelete}
      />
    </div>
  );

  return title ? (
    <section className="space-y-3" data-testid={`integrations-section-${sectionKey}`}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{providerSections}</CardContent>
      </Card>
    </section>
  ) : (
    providerSections
  );
};

const personalContext: AuthenticatedContext = { type: 'user' };

export const IntegrationsPage = ({
  connectFlows = {},
  providerFitsOwner = everyProviderFitsEveryOwner,
}: IntegrationsPageProps) => {
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
          <IntegrationOwnerSection
            context={personalContext}
            connectFlows={connectFlows}
            providerFitsOwner={providerFitsOwner}
            sectionKey="personal"
            title="Personal"
            description="Services connected to your own account."
          />
          {hasMembership ? (
            <IntegrationOwnerSection
              context={context}
              ownership={{ ownedByMyMembership: true }}
              connectFlows={connectFlows}
              providerFitsOwner={providerFitsOwner}
              sectionKey="member"
              title={`Yours in ${tenant.name}`}
              description={`Services connected as you within ${tenant.name}. Only you and its owners see them.`}
            />
          ) : null}
          <IntegrationOwnerSection
            context={context}
            connectFlows={connectFlows}
            providerFitsOwner={providerFitsOwner}
            sectionKey="tenant"
            title={`${tenant.name}'s integrations`}
            description={`Services connected for all of ${tenant.name}.`}
          />
        </div>
      ) : (
        <IntegrationOwnerSection
          context={context}
          connectFlows={connectFlows}
          providerFitsOwner={providerFitsOwner}
          sectionKey="user"
        />
      )}
    </Page>
  );
};
