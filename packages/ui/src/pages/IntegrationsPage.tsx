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
import { Badge, Button, Card, Page } from '@template/ui/components';
import { CreateIntegrationModal } from '@template/ui/components/settings/CreateIntegrationModal';
import {
  createOptimisticListTarget,
  OPTIMISTIC_ID,
  useOptimisticMutation,
  useQuery,
} from '@template/ui/hooks';
import { getContextParams } from '@template/ui/lib/getContextParams';
import { integrationContextQueries } from '@template/ui/lib/integrationContextQueries';
import {
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

export type IntegrationConnectFlowProps = {
  context: AuthenticatedContext;
  onClose: () => void;
  onConnected: () => void;
};

export type IntegrationConnectFlows = Partial<
  Record<IntegrationProvider, (props: IntegrationConnectFlowProps) => ReactNode>
>;

type IntegrationsPageProps = {
  connectFlows?: IntegrationConnectFlows;
};

type IntegrationRowsProps = {
  integrations: Integration[];
  canManage: boolean;
  onDelete: (integration: Integration) => void;
};

const IntegrationRows = ({ integrations, canManage, onDelete }: IntegrationRowsProps) => (
  <ul className="divide-y border-t">
    {integrations.map((integration) => (
      <li key={integration.id} className="flex items-center justify-between px-4 py-2">
        <div>
          <p className="text-sm font-medium">{integration.name}</p>
          <p className="text-xs text-muted-foreground">
            Connected {new Date(integration.createdAt).toLocaleDateString()}
          </p>
        </div>
        {canManage && integration.id !== OPTIMISTIC_ID && (
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
);

export const IntegrationsPage = ({ connectFlows = {} }: IntegrationsPageProps) => {
  const [connectingProvider, setConnectingProvider] = useState<IntegrationProvider | null>(null);
  const queryClient = useQueryClient();
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const permissions = useAppStore((state) => state.permissions);
  const integrationQueries = integrationContextQueries(context);
  const canManage = permissions.check(...getContextParams(context), 'manage');

  const { data, isLoading, isError } = useQuery({
    queryKey: integrationQueries.readMany.queryKey,
    queryFn: integrationQueries.readMany.queryFn,
  });

  const integrations: Integration[] = data?.data ?? [];
  const integrationsOf = (provider: IntegrationProvider | null) =>
    integrations.filter((integration) => (integration.provider ?? null) === provider);
  const unassigned = integrationsOf(null);

  const deleteMutation = useOptimisticMutation({
    mutationFn: integrationQueries.delete.mutationFn,
    targets: [
      createOptimisticListTarget<Integration>({
        queryKey: integrationQueries.readMany.queryKey,
        operation: 'delete',
      }),
    ],
  });

  const createMutation = useOptimisticMutation({
    mutationFn: integrationQueries.create.mutationFn,
    targets: [
      createOptimisticListTarget<Integration>({
        queryKey: integrationQueries.readMany.queryKey,
        operation: 'create',
        optimisticExtras: { createdAt: new Date().toISOString() },
      }),
    ],
  });

  const handleConnect = (body: Pick<MeCreateIntegrationData['body'], 'name' | 'provider'>) => {
    createMutation.mutate({ body });
  };

  const handleDelete = (integration: Integration) =>
    deleteMutation.mutate({ path: { id: integration.id } });

  const canConnect = (provider: IntegrationProvider) =>
    canManage &&
    !isError &&
    (Boolean(connectFlows[provider]) || integrationProviders[provider].directConnect);

  const statusOf = (provider: IntegrationProvider): ProviderStatus => {
    if (integrationsOf(provider).length > 0) return 'connected';
    return canConnect(provider) ? 'notConnected' : 'disabled';
  };

  const closeConnect = () => setConnectingProvider(null);
  const connectFlow = connectingProvider ? connectFlows[connectingProvider] : undefined;

  return (
    <>
      <Page title="Integrations" description="Connect the services this workspace works with">
        {isError && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            Integrations could not be loaded.
          </p>
        )}
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
        ) : (
          <div className="space-y-3">
            {integrationProviderValues.map((provider) => {
              const { label, icon } = integrationProviders[provider];
              const status = statusBadges[statusOf(provider)];
              const providerIntegrations = integrationsOf(provider);
              return (
                <Card key={provider} data-testid={`provider-${provider}`}>
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3">
                      <Icon icon={icon} className="h-6 w-6" aria-hidden />
                      <span className="font-medium">{label}</span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canConnect(provider)}
                      aria-label={`Connect ${label}`}
                      onClick={() => setConnectingProvider(provider)}
                    >
                      <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
                      Connect
                    </Button>
                  </div>
                  {providerIntegrations.length > 0 && (
                    <IntegrationRows
                      integrations={providerIntegrations}
                      canManage={canManage}
                      onDelete={handleDelete}
                    />
                  )}
                </Card>
              );
            })}
            {unassigned.length > 0 && (
              <Card data-testid="provider-none">
                <div className="flex items-center gap-3 p-4">
                  <Icon icon="lucide:plug" className="h-6 w-6" aria-hidden />
                  <span className="font-medium">Other</span>
                </div>
                <IntegrationRows
                  integrations={unassigned}
                  canManage={canManage}
                  onDelete={handleDelete}
                />
              </Card>
            )}
          </div>
        )}
      </Page>

      {connectFlow ? (
        connectFlow({
          context,
          onClose: closeConnect,
          onConnected: () => {
            closeConnect();
            void queryClient.invalidateQueries({ queryKey: integrationQueries.readMany.queryKey });
          },
        })
      ) : (
        <CreateIntegrationModal
          provider={connectingProvider}
          onClose={closeConnect}
          onSubmit={handleConnect}
        />
      )}
    </>
  );
};
