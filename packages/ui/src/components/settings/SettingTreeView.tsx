/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk, primitive:shared, primitive:authz
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccessorName, HydratedRecord } from '@template/db';
import {
  type AssembledSettingItem,
  assembleResourceSettings,
  diffSettingDrafts,
  isSettingLeaf,
  type SettingBranch,
  type SettingNode,
  type SettingResourceKinds,
  settingChildrenFor,
  settingNodesAlongKey,
  settingResourceKindsOf,
  settingsIn,
} from '@template/shared/settings';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@template/ui/components/primitives';
import { SettingField } from '@template/ui/components/settings/SettingField';
import { hydrateSettingTargetForPermissions } from '@template/ui/lib/hydrateRecordForPermissions';
import { useSettingCatalog } from '@template/ui/lib/masterData';
import type { MyMembershipOwnership } from '@template/ui/lib/myMembership';
import {
  type SettingExplicitTarget,
  type SettingListQueryParams,
  settingContextQueries,
  settingQueriesForTarget,
} from '@template/ui/lib/settingContextQueries';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { lowerFirst, omitBy } from 'lodash-es';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

export type SettingTreeViewProps = (
  | { context: AuthenticatedContext; ownership?: MyMembershipOwnership; target?: undefined }
  | { target: SettingExplicitTarget; context?: undefined; ownership?: undefined }
) & {
  path?: SettingListQueryParams['path'];
  title?: string;
  description?: string;
  readOnlyMessage?: string;
  hideWhenEmpty?: boolean;
};

export const SettingTreeView = ({
  context,
  ownership,
  target,
  path,
  title,
  description,
  readOnlyMessage = 'You do not have permission to edit this setting.',
  hideWhenEmpty = true,
}: SettingTreeViewProps) => {
  const queryClient = useQueryClient();
  const auth = useAppStore((state) => state.auth);
  const tenantContext = useAppStore((state) => state.tenant.context);
  const permissions = useAppStore((state) => state.permissions);
  const { catalog, isLoading: isCatalogLoading } = useSettingCatalog();

  const queries = useMemo(
    () =>
      target
        ? settingQueriesForTarget(target)
        : settingContextQueries(context as AuthenticatedContext, ownership),
    [context, ownership, target],
  );

  const kinds = useMemo<SettingResourceKinds>(
    () => settingResourceKindsOf(queries.resourceModel, target?.integrationProvider),
    [queries.resourceModel, target?.integrationProvider],
  );

  const listQueryParams = useMemo(() => (path ? { path } : undefined), [path]);
  const queryKey = queries.readManyQueryKey(listQueryParams);

  const tree = catalog?.trees[queries.resourceModel];
  const definedItems = useMemo(
    () => (tree ? settingsIn(tree, kinds, path) : []),
    [tree, kinds, path],
  );

  const settingsQuery = useQuery({
    queryKey,
    queryFn: queries.readManyQueryFn,
    enabled: definedItems.length > 0,
  });

  const items = useMemo(
    () =>
      tree ? assembleResourceSettings(tree, settingsQuery.data?.data ?? [], { kinds, path }) : [],
    [tree, settingsQuery.data?.data, kinds, path],
  );
  const itemsByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);
  const pathSegments = useMemo(() => (path ? path.split('.') : []), [path]);
  const root = useMemo(() => {
    const node = tree && settingNodesAlongKey(tree, path ?? '', kinds)?.at(-1);
    return node && !isSettingLeaf(node) ? node : undefined;
  }, [tree, path, kinds]);

  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [invalidKeys, setInvalidKeys] = useState<Record<string, boolean>>({});
  const [resetVersion, setResetVersion] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hydratedTarget = useMemo<HydratedRecord | null>(() => {
    if (target) {
      if (!target.record) return null;
      return hydrateSettingTargetForPermissions(
        target.model,
        target.record as Record<string, unknown>,
        auth,
        tenantContext,
      );
    }
    if (!context) return null;
    if (context.type === 'user') {
      if (!auth.user) return null;
      return hydrateSettingTargetForPermissions(
        'User',
        auth.user as unknown as Record<string, unknown>,
        auth,
        context,
      );
    }
    if (context.type === 'organization' && context.organization) {
      if (ownership?.ownedByMyMembership) {
        const myOrgUser = auth.organizationUsers?.[context.organization.id];
        if (!myOrgUser) return null;
        return hydrateSettingTargetForPermissions(
          'OrganizationUser',
          myOrgUser as unknown as Record<string, unknown>,
          auth,
          context,
        );
      }
      return hydrateSettingTargetForPermissions(
        'Organization',
        context.organization as unknown as Record<string, unknown>,
        auth,
        context,
      );
    }
    if (context.type === 'space' && context.space) {
      if (ownership?.ownedByMyMembership) {
        const mySpaceUser = auth.spaceUsers?.[context.space.id];
        if (!mySpaceUser) return null;
        return hydrateSettingTargetForPermissions(
          'SpaceUser',
          mySpaceUser as unknown as Record<string, unknown>,
          auth,
          context,
        );
      }
      return hydrateSettingTargetForPermissions(
        'Space',
        context.space as unknown as Record<string, unknown>,
        auth,
        context,
      );
    }
    return null;
  }, [target, context, ownership?.ownedByMyMembership, auth, tenantContext]);

  const canManageItem = (item: AssembledSettingItem): boolean =>
    Boolean(hydratedTarget) &&
    permissions.check(
      lowerFirst(queries.resourceModel) as AccessorName,
      hydratedTarget as HydratedRecord,
      item.manage,
    );

  const dirtyItems = useMemo(() => diffSettingDrafts(items, drafts), [items, drafts]);
  const hasInvalidFields = useMemo(() => Object.values(invalidKeys).some(Boolean), [invalidKeys]);

  const handleFieldValidityChange = useCallback((key: string, isValid: boolean) => {
    setInvalidKeys((previous) => {
      if (Boolean(previous[key]) === !isValid) return previous;
      if (isValid) return omitBy(previous, (_v, k) => k === key);
      return { ...previous, [key]: true };
    });
  }, []);

  const saveMutation = useMutation({
    throwOnError: false,
    mutationFn: (items: typeof dirtyItems) => queries.updateMany.mutationFn({ body: items }),
    onSuccess: () => {
      setDrafts({});
      setInvalidKeys({});
      setResetVersion((version) => version + 1);
      setErrorMessage(null);
      setStatusMessage('Settings saved');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save settings');
    },
  });

  const resetMutation = useMutation({
    throwOnError: false,
    mutationFn: ({ id }: { id: string; key: string }) =>
      queries.delete.mutationFn({ path: { id } }),
    onSuccess: (_data, variables) => {
      setDrafts((previous) => omitBy(previous, (_v, k) => k === variables.key));
      setInvalidKeys((previous) => omitBy(previous, (_v, k) => k === variables.key));
      setResetVersion((version) => version + 1);
      setErrorMessage(null);
      setStatusMessage('Setting reset to default');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reset setting');
    },
  });

  if (hideWhenEmpty && !isCatalogLoading && items.length === 0) {
    return null;
  }

  const rootLabel = root && path ? root.__label : undefined;
  const resolvedTitle = title ?? rootLabel ?? 'Settings';
  const anyEditable = items.some(canManageItem);

  const renderField = (item: AssembledSettingItem) => {
    const editable = canManageItem(item);
    const storedId = item.settingId;
    return (
      <SettingField
        key={item.key}
        item={item}
        value={item.key in drafts ? drafts[item.key] : item.value}
        resetVersion={resetVersion}
        disabled={!editable}
        disabledText={!editable ? readOnlyMessage : undefined}
        isResetting={resetMutation.isPending && resetMutation.variables?.key === item.key}
        onValidityChange={(isValid) => handleFieldValidityChange(item.key, isValid)}
        onChange={(nextValue) => {
          setStatusMessage(null);
          setErrorMessage(null);
          setDrafts((previous) => ({ ...previous, [item.key]: nextValue }));
        }}
        onReset={storedId ? () => resetMutation.mutate({ id: storedId, key: item.key }) : undefined}
      />
    );
  };

  const renderBranch = (branch: SettingBranch, segments: readonly string[]): ReactNode[] =>
    Object.entries(settingChildrenFor(branch, kinds)).flatMap(([name, node]): ReactNode[] => {
      const childSegments = [...segments, name];
      if (isSettingLeaf(node)) {
        const item = itemsByKey.get(childSegments.join('.'));
        return item ? [renderField(item)] : [];
      }
      const children = renderBranch(node, childSegments);
      if (children.length === 0) return [];
      return [
        <section
          key={childSegments.join('.')}
          className="space-y-4"
          data-testid={`setting-branch-${childSegments.join('.')}`}
        >
          {node.__label ? (
            <h3 className="text-sm font-semibold text-foreground">{node.__label}</h3>
          ) : null}
          {children}
        </section>,
      ];
    });

  return (
    <Card data-testid={`resource-settings-${queries.resourceModel}`}>
      <CardHeader>
        <Skeleton isLoading={isCatalogLoading && !title}>
          <CardTitle>{resolvedTitle}</CardTitle>
        </Skeleton>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-5" isLoading={isCatalogLoading || settingsQuery.isLoading}>
        {root
          ? renderBranch(root, pathSegments)
          : itemsByKey.has(pathSegments.join('.'))
            ? renderField(itemsByKey.get(pathSegments.join('.')) as AssembledSettingItem)
            : null}

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        {statusMessage ? (
          <p role="status" className="text-sm text-muted-foreground">
            {statusMessage}
          </p>
        ) : null}

        {anyEditable ? (
          <div className="flex items-center justify-end gap-2 pt-2">
            {dirtyItems.length > 0 || hasInvalidFields ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saveMutation.isPending}
                onClick={() => {
                  setDrafts({});
                  setInvalidKeys({});
                  setResetVersion((version) => version + 1);
                  setErrorMessage(null);
                }}
              >
                Discard
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={dirtyItems.length === 0 || hasInvalidFields || saveMutation.isPending}
              onClick={() => saveMutation.mutate(dirtyItems)}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
