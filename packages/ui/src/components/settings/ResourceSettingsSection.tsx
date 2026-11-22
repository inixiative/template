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
  SETTING_DEFINITIONS,
} from '@template/shared/settings';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives';
import { SettingField } from '@template/ui/components/settings/SettingField';
import { useSettingCatalog } from '@template/ui/hooks/settings/useSettingInfo';
import { hydrateSettingTargetForPermissions } from '@template/ui/lib/hydrateRecordForPermissions';
import type { MyMembershipOwnership } from '@template/ui/lib/myMembership';
import {
  type SettingExplicitTarget,
  type SettingListQueryParams,
  settingContextQueries,
  settingQueriesForTarget,
} from '@template/ui/lib/settingContextQueries';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { lowerFirst } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

export type ResourceSettingsSectionProps = (
  | { context: AuthenticatedContext; ownership?: MyMembershipOwnership; target?: undefined }
  | { target: SettingExplicitTarget; context?: undefined; ownership?: undefined }
) & {
  category?: SettingListQueryParams['category'];
  title?: string;
  description?: string;
  readOnlyMessage?: string;
  hideWhenEmpty?: boolean;
};

export const ResourceSettingsSection = ({
  context,
  ownership,
  target,
  category,
  title,
  description,
  readOnlyMessage = 'You do not have permission to edit this setting.',
  hideWhenEmpty = true,
}: ResourceSettingsSectionProps) => {
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

  const listQueryParams = useMemo(() => (category ? { category } : undefined), [category]);
  const queryKey = queries.readManyQueryKey(listQueryParams);

  const hasCatalogDefinitions = useMemo(() => {
    if (!catalog) return false;
    return Object.values(catalog.definitions).some(
      (def) =>
        def.resourceModels.includes(queries.resourceModel) &&
        (!category || def.category === category),
    );
  }, [catalog, queries.resourceModel, category]);

  const settingsQuery = useQuery({
    queryKey,
    queryFn: queries.readManyQueryFn,
    enabled: hasCatalogDefinitions,
  });

  const assembled = useMemo(() => {
    if (!catalog) return { items: [] as AssembledSettingItem[], byCategory: {} };
    return assembleResourceSettings(
      catalog,
      settingsQuery.data?.data ?? [],
      queries.resourceModel,
      { category },
    );
  }, [catalog, settingsQuery.data?.data, queries.resourceModel, category]);

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

  const canManageItem = (item: AssembledSettingItem): boolean => {
    if (!hydratedTarget) return false;
    if (item.key in SETTING_DEFINITIONS) {
      return permissions.check(
        'setting',
        {
          id: item.settingId ?? '',
          resourceModel: queries.resourceModel,
          resourceId: hydratedTarget.id,
          key: item.key,
          [`resource${queries.resourceModel}`]: hydratedTarget,
        } as HydratedRecord,
        'manage',
      );
    }
    return permissions.check(
      lowerFirst(queries.resourceModel) as AccessorName,
      hydratedTarget,
      item.permission,
    );
  };

  const dirtyItems = useMemo(
    () => diffSettingDrafts(assembled.items, drafts),
    [assembled.items, drafts],
  );
  const hasInvalidFields = useMemo(() => Object.values(invalidKeys).some(Boolean), [invalidKeys]);

  const handleFieldValidityChange = useCallback((key: string, isValid: boolean) => {
    setInvalidKeys((previous) => {
      if (Boolean(previous[key]) === !isValid) return previous;
      if (isValid) {
        const next = { ...previous };
        delete next[key];
        return next;
      }
      return { ...previous, [key]: true };
    });
  }, []);

  const saveMutation = useMutation({
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
    mutationFn: ({ id }: { id: string; key: string }) =>
      queries.delete.mutationFn({ path: { id } }),
    onSuccess: (_data, variables) => {
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[variables.key];
        return next;
      });
      setInvalidKeys((previous) => {
        const next = { ...previous };
        delete next[variables.key];
        return next;
      });
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

  if (isCatalogLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-muted/50" />;
  }

  if (hideWhenEmpty && assembled.items.length === 0) {
    return null;
  }

  const categoryInfo = category ? catalog?.categories[category] : undefined;
  const resolvedTitle = title ?? categoryInfo?.label ?? 'Settings';
  const resolvedDescription = description ?? categoryInfo?.description;
  const anyEditable = assembled.items.some(canManageItem);

  return (
    <Card data-testid={`resource-settings-${queries.resourceModel}`}>
      <CardHeader>
        <CardTitle>{resolvedTitle}</CardTitle>
        {resolvedDescription ? <CardDescription>{resolvedDescription}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {settingsQuery.isLoading ? (
          <div className="h-20 animate-pulse rounded-md bg-muted/50" />
        ) : (
          <>
            {assembled.items.map((item) => {
              const editable = canManageItem(item);
              const currentValue = item.key in drafts ? drafts[item.key] : item.value;
              const storedId = item.settingId;
              return (
                <SettingField
                  key={item.key}
                  item={item}
                  value={currentValue}
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
                  onReset={
                    storedId
                      ? () => resetMutation.mutate({ id: storedId, key: item.key })
                      : undefined
                  }
                />
              );
            })}

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
          </>
        )}
      </CardContent>
    </Card>
  );
};
