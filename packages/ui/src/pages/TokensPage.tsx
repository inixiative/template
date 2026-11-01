/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { Icon } from '@iconify/react';
import type { MeCreateTokenData, MeReadManyTokensResponse } from '@template/sdk';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Page,
  Table,
} from '@template/ui/components';
import { CreateTokenModal } from '@template/ui/components/settings/CreateTokenModal';
import { SecretRevealModal } from '@template/ui/components/utility/SecretRevealModal';
import {
  createOptimisticListTarget,
  useOptimisticMutation,
  useQuery,
  useSectionOpen,
} from '@template/ui/hooks';
import { type TokenOwnerScope, tokenContextQueries } from '@template/ui/lib/tokenContextQueries';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { useState } from 'react';

type Token = MeReadManyTokensResponse['data'][number];
type CreatedToken = Token & { key: string };

type TokenSectionProps = {
  context: AuthenticatedContext;
  scope?: TokenOwnerScope;
  title?: string;
  description?: string;
  sectionKey: string;
};

const TokenSection = ({ context, scope, title, description, sectionKey }: TokenSectionProps) => {
  const [isModalOpen, setIsModalOpen] = useSectionOpen(
    sectionKey === 'member' ? 'create-token-member' : 'create-token',
  );
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const tokenQueries = tokenContextQueries(context, scope);

  const { data, isLoading } = useQuery({
    queryKey: tokenQueries.readMany.queryKey,
    queryFn: tokenQueries.readMany.queryFn,
  });

  const tokens = data?.data ?? [];

  const deleteMutation = useOptimisticMutation({
    mutationFn: tokenQueries.delete.mutationFn,
    targets: [
      createOptimisticListTarget<Token>({
        queryKey: tokenQueries.readMany.queryKey,
        operation: 'delete',
      }),
    ],
  });

  const createMutation = useOptimisticMutation({
    mutationFn: tokenQueries.create.mutationFn,
    targets: [
      createOptimisticListTarget<Token, unknown, { data: CreatedToken }>({
        queryKey: tokenQueries.readMany.queryKey,
        operation: 'create',
        optimisticExtras: { createdAt: new Date().toISOString(), lastUsedAt: null },
        itemFromResponse: ({ data: { key: _key, ...token } }) => token,
      }),
    ],
  });

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (item: Token) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (item: Token) => (
        <span className="text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'lastUsedAt',
      label: 'Last Used',
      render: (item: Token) => (
        <span className="text-muted-foreground">
          {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: Token) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${item.name}`}
            onClick={() => deleteMutation.mutate({ path: { id: item.id } })}
          >
            <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = (body: Pick<MeCreateTokenData['body'], 'name' | 'role'>) => {
    createMutation.mutate(
      { body },
      { onSuccess: (response) => setRevealedKey(response.data?.key ?? null) },
    );
    setIsModalOpen(false);
  };

  const createButton = (
    <Button onClick={() => setIsModalOpen(true)}>
      <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
      Create token
    </Button>
  );

  const table = isLoading ? (
    <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
  ) : (
    <Table
      columns={columns}
      data={tokens}
      keyExtractor={(item) => item.id}
      emptyMessage="No API tokens created yet"
      empty={{
        icon: 'lucide:key-round',
        description: 'Tokens let scripts and integrations call the API on your behalf.',
        action: { label: 'Create token', onClick: () => setIsModalOpen(true) },
      }}
    />
  );

  return (
    <>
      {title ? (
        <Card data-testid={`tokens-${sectionKey}`}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{title}</CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
            {createButton}
          </CardHeader>
          <CardContent>{table}</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">{createButton}</div>
          {table}
        </div>
      )}

      <CreateTokenModal
        isOpen={isModalOpen && !revealedKey}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
      />

      <SecretRevealModal
        secret={revealedKey}
        title="Your new API token"
        label="API token"
        onDismiss={() => setRevealedKey(null)}
      />
    </>
  );
};

export const TokensPage = () => {
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
    <Page title="API tokens" description="Create and manage API tokens for programmatic access">
      {tenant ? (
        <div className="space-y-6">
          {hasMembership ? (
            <TokenSection
              context={context}
              scope={{ member: true }}
              sectionKey="member"
              title={`Yours in ${tenant.name}`}
              description={`Tokens that act as you within ${tenant.name}. Only you and its owners see them.`}
            />
          ) : null}
          <TokenSection
            context={context}
            sectionKey="tenant"
            title={`${tenant.name}'s tokens`}
            description={`Tokens that act as ${tenant.name}.`}
          />
        </div>
      ) : (
        <TokenSection context={context} sectionKey="user" />
      )}
    </Page>
  );
};
