/**
 * @atlas
 * @kind query
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { QueryKey } from '@tanstack/react-query';
import type { HydratedRecord } from '@template/db';
import {
  integrationReadManySettings,
  integrationReadManySettingsQueryKey,
  integrationUpdateManySettings,
  type MeReadManySettingsData,
  type MeUpdateManySettingsData,
  meReadManySettings,
  meReadManySettingsQueryKey,
  meUpdateManySettings,
  organizationReadManySettings,
  organizationReadManySettingsQueryKey,
  organizationUpdateManySettings,
  organizationUserReadManySettings,
  organizationUserReadManySettingsQueryKey,
  organizationUserUpdateManySettings,
  projectIntegrationReadManySettings,
  projectIntegrationReadManySettingsQueryKey,
  projectIntegrationUpdateManySettings,
  projectReadManySettings,
  projectReadManySettingsQueryKey,
  projectUpdateManySettings,
  settingDelete,
  spaceReadManySettings,
  spaceReadManySettingsQueryKey,
  spaceUpdateManySettings,
  spaceUserReadManySettings,
  spaceUserReadManySettingsQueryKey,
  spaceUserUpdateManySettings,
} from '@template/sdk';
import type { SettingResourceModelName, SettingUpsertDraftItem } from '@template/shared/settings';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import type { IntegrationProvider } from '@template/ui/lib/integrationProviders';
import type { ClientInjectedOptions } from '@template/ui/lib/makeAuthenticatedApiFetch';
import { makeContextQueries, mutation } from '@template/ui/lib/makeContextQueries';
import {
  type MyMembershipOwnership,
  myOrganizationUserOrThrow,
  mySpaceUserOrThrow,
} from '@template/ui/lib/myMembership';

export type SettingListQueryParams = NonNullable<MeReadManySettingsData['query']>;
type ReadManyOptions = Parameters<typeof meReadManySettings>[0];
type UpdateManySdkBody = MeUpdateManySettingsData['body'];
export type SettingUpdateManyVariables = { body: SettingUpsertDraftItem[] };
type UpdateManyOptions = SettingUpdateManyVariables & ClientInjectedOptions;

export type SettingExplicitTarget = {
  model: 'Project' | 'Integration' | 'ProjectIntegration';
  id: string;
  record?: HydratedRecord;
  integrationProvider?: IntegrationProvider;
};

const deleteSetting = mutation({
  mutationFn: apiMutation((opts: Parameters<typeof settingDelete>[0]) => settingDelete(opts)),
});

const buildSettingQueries = (
  resourceModel: SettingResourceModelName,
  readManyQueryKey: (query?: SettingListQueryParams) => QueryKey,
  readMany: (opts: ReadManyOptions) => ReturnType<typeof meReadManySettings<true>>,
  updateMany: (opts: UpdateManyOptions) => ReturnType<typeof meUpdateManySettings<true>>,
) => ({
  resourceModel,
  readManyQueryKey,
  readManyQueryFn: apiQuery(readMany),
  updateMany: mutation({ mutationFn: apiMutation(updateMany) }),
  delete: deleteSetting,
});

export type ResourceSettingQueries = ReturnType<typeof buildSettingQueries>;

/** Tenant-context setting queries for User (me), Organization, OrganizationUser, Space, and SpaceUser. */
export const settingContextQueries = makeContextQueries<MyMembershipOwnership>()({
  user: () =>
    buildSettingQueries(
      'User',
      (query) => meReadManySettingsQueryKey({ query }),
      (opts) => meReadManySettings({ ...opts, throwOnError: true }),
      (opts) =>
        meUpdateManySettings({
          ...opts,
          body: opts.body as UpdateManySdkBody,
          throwOnError: true,
        }),
    ),
  organization: ({ organization }, ownership) => {
    if (!ownership?.ownedByMyMembership) {
      const path = { id: organization.id };
      return buildSettingQueries(
        'Organization',
        (query) => organizationReadManySettingsQueryKey({ path, query }),
        (opts) => organizationReadManySettings({ ...opts, path, throwOnError: true }),
        (opts) =>
          organizationUpdateManySettings({
            ...opts,
            path,
            body: opts.body as UpdateManySdkBody,
            throwOnError: true,
          }),
      );
    }
    const path = { id: myOrganizationUserOrThrow(organization.id).id };
    return buildSettingQueries(
      'OrganizationUser',
      (query) => organizationUserReadManySettingsQueryKey({ path, query }),
      (opts) => organizationUserReadManySettings({ ...opts, path, throwOnError: true }),
      (opts) =>
        organizationUserUpdateManySettings({
          ...opts,
          path,
          body: opts.body as UpdateManySdkBody,
          throwOnError: true,
        }),
    );
  },
  space: ({ space }, ownership) => {
    if (!ownership?.ownedByMyMembership) {
      const path = { id: space.id };
      return buildSettingQueries(
        'Space',
        (query) => spaceReadManySettingsQueryKey({ path, query }),
        (opts) => spaceReadManySettings({ ...opts, path, throwOnError: true }),
        (opts) =>
          spaceUpdateManySettings({
            ...opts,
            path,
            body: opts.body as UpdateManySdkBody,
            throwOnError: true,
          }),
      );
    }
    const path = { id: mySpaceUserOrThrow(space.id).id };
    return buildSettingQueries(
      'SpaceUser',
      (query) => spaceUserReadManySettingsQueryKey({ path, query }),
      (opts) => spaceUserReadManySettings({ ...opts, path, throwOnError: true }),
      (opts) =>
        spaceUserUpdateManySettings({
          ...opts,
          path,
          body: opts.body as UpdateManySdkBody,
          throwOnError: true,
        }),
    );
  },
});

/** Explicit-target setting queries for Project, Integration, and ProjectIntegration. */
export const settingQueriesForTarget = (target: SettingExplicitTarget): ResourceSettingQueries => {
  const path = { id: target.id };
  switch (target.model) {
    case 'Project':
      return buildSettingQueries(
        'Project',
        (query) => projectReadManySettingsQueryKey({ path, query }),
        (opts) => projectReadManySettings({ ...opts, path, throwOnError: true }),
        (opts) =>
          projectUpdateManySettings({
            ...opts,
            path,
            body: opts.body as UpdateManySdkBody,
            throwOnError: true,
          }),
      );
    case 'Integration':
      return buildSettingQueries(
        'Integration',
        (query) => integrationReadManySettingsQueryKey({ path, query }),
        (opts) => integrationReadManySettings({ ...opts, path, throwOnError: true }),
        (opts) =>
          integrationUpdateManySettings({
            ...opts,
            path,
            body: opts.body as UpdateManySdkBody,
            throwOnError: true,
          }),
      );
    case 'ProjectIntegration':
      return buildSettingQueries(
        'ProjectIntegration',
        (query) => projectIntegrationReadManySettingsQueryKey({ path, query }),
        (opts) => projectIntegrationReadManySettings({ ...opts, path, throwOnError: true }),
        (opts) =>
          projectIntegrationUpdateManySettings({
            ...opts,
            path,
            body: opts.body as UpdateManySdkBody,
            throwOnError: true,
          }),
      );
  }
};
