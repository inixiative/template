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
  billingAccountDelete,
  billingAccountPortalSession,
  billingAccountSetupSession,
  billingAccountUpdate,
  meCreateBillingAccount,
  meReadManyBillingAccounts,
  organizationCreateBillingAccount,
  organizationReadManyBillingAccounts,
  organizationUserCreateBillingAccount,
  organizationUserReadManyBillingAccounts,
  spaceCreateBillingAccount,
  spaceReadManyBillingAccounts,
  spaceUserCreateBillingAccount,
  spaceUserReadManyBillingAccounts,
} from '@template/sdk';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
} from '@template/ui/components/primitives';
import { useAppStore } from '@template/ui/store';
import { useId, useMemo, useState } from 'react';

export type BillingAccountOwnerScope =
  | { ownerModel: 'User' }
  | { ownerModel: 'Organization'; id: string }
  | { ownerModel: 'Space'; id: string }
  | { ownerModel: 'OrganizationUser'; id: string }
  | { ownerModel: 'SpaceUser'; id: string };

export type BillingAccountsSectionProps = {
  scope: BillingAccountOwnerScope;
  returnUrl: string;
  canManage?: boolean;
  title?: string;
  description?: string;
};

type BillingAccountRow = BillingAccountReadResponse['data'];

const SHARING_OPTIONS = [
  { value: 'inherit', label: 'Inherit sharing' },
  { value: 'on', label: 'Shared with members' },
  { value: 'off', label: 'Private' },
] as const;

const statusBadgeVariant = (status: BillingAccountRow['status']) => {
  switch (status) {
    case 'active':
      return 'default' as const;
    case 'pastDue':
    case 'expired':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
};

const listQueryKeyForScope = (scope: BillingAccountOwnerScope) =>
  scope.ownerModel === 'User'
    ? ['billingAccounts', 'User']
    : ['billingAccounts', scope.ownerModel, scope.id];

const fetchAccountsForScope = async (
  scope: BillingAccountOwnerScope,
): Promise<BillingAccountRow[]> => {
  switch (scope.ownerModel) {
    case 'User': {
      const res = await meReadManyBillingAccounts({ throwOnError: true });
      return res.data.data;
    }
    case 'Organization': {
      const res = await organizationReadManyBillingAccounts({
        path: { id: scope.id },
        throwOnError: true,
      });
      return res.data.data;
    }
    case 'Space': {
      const res = await spaceReadManyBillingAccounts({
        path: { id: scope.id },
        throwOnError: true,
      });
      return res.data.data;
    }
    case 'OrganizationUser': {
      const res = await organizationUserReadManyBillingAccounts({
        path: { id: scope.id },
        throwOnError: true,
      });
      return res.data.data;
    }
    case 'SpaceUser': {
      const res = await spaceUserReadManyBillingAccounts({
        path: { id: scope.id },
        throwOnError: true,
      });
      return res.data.data;
    }
  }
};

const createAccountForScope = async (
  scope: BillingAccountOwnerScope,
  body: { name: string; billingEmail: string },
) => {
  switch (scope.ownerModel) {
    case 'User': {
      const res = await meCreateBillingAccount({ body, throwOnError: true });
      return res.data.data;
    }
    case 'Organization': {
      const res = await organizationCreateBillingAccount({
        path: { id: scope.id },
        body,
        throwOnError: true,
      });
      return res.data.data;
    }
    case 'Space': {
      const res = await spaceCreateBillingAccount({
        path: { id: scope.id },
        body,
        throwOnError: true,
      });
      return res.data.data;
    }
    case 'OrganizationUser': {
      const res = await organizationUserCreateBillingAccount({
        path: { id: scope.id },
        body,
        throwOnError: true,
      });
      return res.data.data;
    }
    case 'SpaceUser': {
      const res = await spaceUserCreateBillingAccount({
        path: { id: scope.id },
        body,
        throwOnError: true,
      });
      return res.data.data;
    }
  }
};

export const BillingAccountsSection = ({
  scope,
  returnUrl,
  canManage,
  title = 'Billing Accounts',
  description = 'Manage payment methods, default billing accounts, and billing portal access.',
}: BillingAccountsSectionProps) => {
  const queryClient = useQueryClient();
  const permissions = useAppStore((s) => s.permissions);
  const authUser = useAppStore((s) => s.auth.user);
  const queryKey = listQueryKeyForScope(scope);
  const nameInputId = useId();
  const emailInputId = useId();

  const [name, setName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isManageable = useMemo(() => {
    if (canManage !== undefined) return canManage;
    switch (scope.ownerModel) {
      case 'User':
        return Boolean(authUser?.id);
      case 'Organization':
        return permissions.check('organization', { id: scope.id } as HydratedRecord, 'manage');
      case 'Space':
        return permissions.check('space', { id: scope.id } as HydratedRecord, 'manage');
      case 'OrganizationUser':
        return permissions.check(
          'organizationUser',
          { id: scope.id, user: authUser ? { id: authUser.id } : undefined } as HydratedRecord,
          'operate',
        );
      case 'SpaceUser':
        return permissions.check(
          'spaceUser',
          { id: scope.id, user: authUser ? { id: authUser.id } : undefined } as HydratedRecord,
          'operate',
        );
    }
  }, [canManage, scope, permissions, authUser]);

  const accountsQuery = useQuery({
    queryKey,
    queryFn: () => fetchAccountsForScope(scope),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAccountForScope(scope, { name: name.trim(), billingEmail: billingEmail.trim() }),
    onSuccess: () => {
      setName('');
      setBillingEmail('');
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create billing account'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) =>
      billingAccountUpdate({ path: { id }, body: { isDefault: true }, throwOnError: true }),
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update default account'),
  });

  const updateSharingMutation = useMutation({
    mutationFn: ({ id, sharing }: { id: string; sharing: BillingAccountRow['sharing'] }) =>
      billingAccountUpdate({ path: { id }, body: { sharing }, throwOnError: true }),
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update sharing mode'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => billingAccountDelete({ path: { id }, throwOnError: true }),
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete billing account'),
  });

  const openSetupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await billingAccountSetupSession({
        path: { id },
        body: { successUrl: returnUrl, returnUrl, mode: 'payAsYouGo' },
        throwOnError: true,
      });
      return res.data.data.url;
    },
    onSuccess: (url) => {
      window.location.assign(url);
    },
    onError: (err) =>
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start payment setup'),
  });

  const openPortalMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await billingAccountPortalSession({
        path: { id },
        body: { returnUrl },
        throwOnError: true,
      });
      return res.data.data.url;
    },
    onSuccess: (url) => {
      window.location.assign(url);
    },
    onError: (err) =>
      setErrorMessage(err instanceof Error ? err.message : 'Failed to open billing portal'),
  });

  const accounts = accountsQuery.data ?? [];
  const supportsSharing = scope.ownerModel === 'Organization' || scope.ownerModel === 'Space';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        {accountsQuery.isError && (
          <p className="text-sm text-destructive">Failed to load billing accounts.</p>
        )}

        {accountsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading billing accounts…</p>
        ) : accounts.length === 0 ? (
          <EmptyState
            title="No billing accounts"
            description="Add a billing account to configure payment methods and billing portal access."
          />
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{account.name}</span>
                    {account.isDefault && <Badge variant="outline">Default</Badge>}
                    {supportsSharing && account.isShared && (
                      <Badge variant="secondary">Shared</Badge>
                    )}
                    <Badge variant={statusBadgeVariant(account.status)}>{account.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {account.billingEmail}
                    {account.paymentMethodBrand && account.paymentMethodLast4
                      ? ` · ${account.paymentMethodBrand} •••• ${account.paymentMethodLast4}`
                      : ''}
                  </p>
                </div>

                {isManageable && (
                  <div className="flex flex-wrap items-center gap-2">
                    {supportsSharing && (
                      <Select
                        aria-label={`Sharing for ${account.name}`}
                        className="h-8 w-auto text-xs"
                        options={SHARING_OPTIONS}
                        value={account.sharing}
                        disabled={updateSharingMutation.isPending}
                        onChange={(sharing) =>
                          updateSharingMutation.mutate({ id: account.id, sharing })
                        }
                      />
                    )}
                    {account.status === 'incomplete' ? (
                      <Button
                        size="sm"
                        onClick={() => openSetupMutation.mutate(account.id)}
                        disabled={openSetupMutation.isPending}
                      >
                        Add Payment Method
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPortalMutation.mutate(account.id)}
                        disabled={openPortalMutation.isPending}
                      >
                        Manage Billing
                      </Button>
                    )}
                    {!account.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDefaultMutation.mutate(account.id)}
                        disabled={setDefaultMutation.isPending}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(account.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isManageable && (
          <form
            className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim() || !billingEmail.trim()) return;
              createMutation.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor={nameInputId}>Account Name</Label>
              <Input
                id={nameInputId}
                placeholder="Primary Billing"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={emailInputId}>Billing Email</Label>
              <Input
                id={emailInputId}
                type="email"
                placeholder="billing@company.com"
                value={billingEmail}
                onChange={(event) => setBillingEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              Add Account
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
