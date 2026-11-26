/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { HydratedRecord } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import {
  buildIntegration,
  buildOrganization,
  buildOrganizationUser,
  buildProject,
  buildProjectIntegration,
  buildSetting,
  buildSpace,
  buildSpaceUser,
  buildUser,
} from '@template/db/test';
import type { MeReadResponses } from '@template/sdk';
import type { RawSettingRow, SettingCatalog } from '@template/shared/settings';
import {
  SettingTreeView,
  type SettingTreeViewProps,
} from '@template/ui/components/settings/SettingTreeView';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib/permissionCheckTargetForTenantContext';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const initialState = useAppStore.getState();

const manyTimezones = Array.from({ length: 15 }, (_, idx) => `Zone/City_${idx}`);
const defaultTimezone = {
  valueType: 'text',
  options: ['UTC', ...manyTimezones].map((value) => ({ value, label: value })),
  defaultValue: 'UTC',
  label: 'Default Timezone',
  description: 'Real compiled setting key across tenant models',
} as const;
const displayLocale = {
  valueType: 'text',
  options: ['en', 'es', 'fr'].map((value) => ({ value, label: value })),
  defaultValue: 'en',
  label: 'Display Locale',
  description: 'Real compiled setting key including membership scopes',
} as const;
const featureEnabled = {
  valueType: 'boolean',
  defaultValue: false,
  label: 'Feature Enabled',
  description: 'Boolean toggle',
} as const;

const fullCatalog: SettingCatalog = {
  trees: {
    User: { __read: 'read', __manage: 'manage', general: { defaultTimezone, displayLocale } },
    Organization: {
      __read: 'read',
      __manage: 'manage',
      general: {
        __label: 'General',
        defaultTimezone,
        displayLocale,
        featureEnabled,
        maxRetries: {
          valueType: 'number',
          conditions: {
            field: 'value',
            operator: Operator.lessThanEquals,
            value: 10,
            error: 'At most 10 retries',
          },
          defaultValue: 3,
          label: 'Max Retries',
          description: 'Numeric input',
        },
        snoozeUntil: {
          valueType: 'date',
          defaultValue: null,
          label: 'Snooze Until',
          description: 'Date-time input',
        },
        topics: {
          valueType: 'multiSelect',
          options: ['alerts', 'billing', 'digest'].map((value) => ({ value, label: value })),
          defaultValue: ['alerts'],
          label: 'Topics',
          description: 'Multi-select checkbox pills',
        },
      },
    },
    Space: { __read: 'read', __manage: 'manage', general: { defaultTimezone, displayLocale } },
    OrganizationUser: {
      __read: 'operate',
      __manage: 'operate',
      general: {
        displayLocale,
        memberAdminOnly: {
          valueType: 'boolean',
          defaultValue: false,
          label: 'Member Admin Flag',
          description: 'Manage-gated setting on OrganizationUser',
          __read: 'read',
          __manage: 'manage',
        },
      },
    },
    SpaceUser: { __read: 'operate', __manage: 'operate', general: { displayLocale } },
    Project: { __read: 'read', __manage: 'manage', general: { defaultTimezone } },
    Integration: { __read: 'read', __manage: 'manage', general: { featureEnabled } },
    ProjectIntegration: { __read: 'read', __manage: 'manage', general: { featureEnabled } },
  },
};

type RecordedRequest = { method: string; path: string; body: unknown };
type MePayload = MeReadResponses[200]['data'];

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let requests: RecordedRequest[];
let storedRowsByPath: Record<string, RawSettingRow[]>;

const installRealSession = async (opts: {
  user: ReturnType<Awaited<ReturnType<typeof buildUser>>['entity']['__serialize']>;
  organizations?: Array<
    ReturnType<Awaited<ReturnType<typeof buildOrganization>>['entity']['__serialize']>
  >;
  organizationUsers?: Array<
    ReturnType<Awaited<ReturnType<typeof buildOrganizationUser>>['entity']['__serialize']>
  >;
  spaces?: Array<ReturnType<Awaited<ReturnType<typeof buildSpace>>['entity']['__serialize']>>;
  spaceUsers?: Array<
    ReturnType<Awaited<ReturnType<typeof buildSpaceUser>>['entity']['__serialize']>
  >;
  context: AuthenticatedContext;
}) => {
  const organizations = opts.organizations ?? [];
  const organizationUsers = opts.organizationUsers ?? [];
  const spaces = opts.spaces ?? [];
  const spaceUsers = opts.spaceUsers ?? [];

  const me = {
    ...opts.user,
    organizations,
    organizationUsers,
    spaces,
    spaceUsers,
  } as unknown as MePayload;

  useAppStore.setState((state) => ({
    auth: {
      ...state.auth,
      user: opts.user as unknown as typeof state.auth.user,
      organizations: Object.fromEntries(
        organizations.map((org) => [org.id, org]),
      ) as unknown as typeof state.auth.organizations,
      organizationUsers: Object.fromEntries(
        organizationUsers.map((member) => [member.organizationId, member]),
      ) as unknown as typeof state.auth.organizationUsers,
      spaces: Object.fromEntries(
        spaces.map((space) => [space.id, space]),
      ) as unknown as typeof state.auth.spaces,
      spaceUsers: Object.fromEntries(
        spaceUsers.map((member) => [member.spaceId, member]),
      ) as unknown as typeof state.auth.spaceUsers,
      isAuthenticated: true,
    },
    tenant: { ...state.tenant, context: opts.context },
  }));

  await useAppStore.getState().permissions.installPermissionsForUser(me);
};

const renderSettingTreeView = (props: SettingTreeViewProps) =>
  render(
    <QueryClientProvider client={client}>
      <SettingTreeView {...props} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  storedRowsByPath = {};
  requests = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const intercept = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const path = url.pathname;
    const text = await request.clone().text();
    const body = text ? (JSON.parse(text) as unknown) : null;
    requests.push({ method: request.method, path, body });

    if (request.method === 'GET' && path === '/api/v1/setting/info') {
      return Response.json({ data: { guide: {}, types: fullCatalog } });
    }
    if (request.method === 'GET' && path.endsWith('/settings')) {
      return Response.json({ data: storedRowsByPath[path] ?? [] });
    }
    if (request.method === 'PATCH' && path.endsWith('/settings')) {
      return Response.json({ data: storedRowsByPath[path] ?? [] });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/v1/setting/')) {
      const deletedId = path.split('/').pop();
      for (const key of Object.keys(storedRowsByPath)) {
        storedRowsByPath[key] = (storedRowsByPath[key] ?? []).filter((row) => row.id !== deletedId);
      }
      return new Response(null, { status: 204 });
    }
    return Response.json({ message: 'Unexpected request' }, { status: 400 });
  };

  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  useAppStore.getState().permissions.clear();
  useAppStore.setState(initialState);
  client.clear();
});

describe('SettingTreeView & SettingField', () => {
  it('renders every setting value type, allows Backspace-clearing numbers, shows the message of a failing condition, disables Save on invalid input, re-enables disabled rows on save, and batch-saves only dirty keys', async () => {
    const { entity: user } = await buildUser();
    const { entity: org } = await buildOrganization();
    const { entity: adminMember } = await buildOrganizationUser(
      { role: Role.admin },
      { user, organization: org },
    );

    const serializedOrg = org.__serialize();
    const orgContext = {
      type: 'organization',
      organization: serializedOrg,
    } as unknown as AuthenticatedContext;

    await installRealSession({
      user: user.__serialize(),
      organizations: [serializedOrg],
      organizationUsers: [adminMember.__serialize()],
      context: orgContext,
    });

    const { entity: localeRow } = await buildSetting({
      resourceModel: 'Organization',
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'general.displayLocale',
      valueText: 'es',
      disabled: false,
    });
    const { entity: disabledTzRow } = await buildSetting({
      resourceModel: 'Organization',
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'general.defaultTimezone',
      valueText: 'Zone/City_1',
      disabled: true,
    });
    storedRowsByPath[`/api/v1/organization/${org.id}/settings`] = [
      localeRow.__serialize() as unknown as RawSettingRow,
      disabledTzRow.__serialize() as unknown as RawSettingRow,
    ];

    renderSettingTreeView({ context: orgContext, path: 'general' });
    await screen.findByTestId('setting-field-general.defaultTimezone');

    // SearchableSelect (> 12 enum options) with disabled row falling back to default 'UTC'
    const tzField = screen.getByTestId('setting-field-general.defaultTimezone');
    expect(
      within(tzField).getByRole('combobox', { name: 'Default Timezone' }).textContent,
    ).toContain('UTC');
    expect(within(tzField).getByText('Default')).toBeDefined();

    // Select (<= 12 enum options)
    const localeSelect = screen.getByLabelText('Display Locale') as HTMLSelectElement;
    expect(localeSelect.tagName).toBe('SELECT');
    expect(localeSelect.value).toBe('es');

    const saveButton = screen.getByRole('button', { name: 'Save settings' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    // Number input: Backspace clearing a 1-digit value keeps input empty and disables Save
    const retriesInput = screen.getByLabelText('Max Retries') as HTMLInputElement;
    expect(retriesInput.value).toBe('3');
    fireEvent.click(screen.getByLabelText('Feature Enabled'));
    expect(saveButton.disabled).toBe(false);

    fireEvent.change(retriesInput, { target: { value: '' } });
    expect(retriesInput.value).toBe('');
    expect(saveButton.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('Enter a valid number');

    fireEvent.change(retriesInput, { target: { value: '7' } });
    expect(retriesInput.value).toBe('7');
    expect(saveButton.disabled).toBe(false);

    // Multi-select pill toggle
    fireEvent.click(
      within(screen.getByTestId('setting-field-general.topics')).getByText('billing'),
    );

    // A value failing the leaf's conditions disables Save, with the condition's message
    fireEvent.change(retriesInput, { target: { value: '70' } });
    expect(screen.getByRole('alert').textContent).toContain('At most 10 retries');
    expect(saveButton.disabled).toBe(true);
    fireEvent.change(retriesInput, { target: { value: '7' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton.disabled).toBe(false);

    // Re-enable disabled row by choosing a new option via SearchableSelect
    fireEvent.click(within(tzField).getByRole('combobox', { name: 'Default Timezone' }));
    fireEvent.click(within(tzField).getByRole('option', { name: 'Zone/City_2' }));

    fireEvent.click(saveButton);

    await waitFor(() => expect(requests.some((r) => r.method === 'PATCH')).toBe(true));
    const patchReq = requests.find((r) => r.method === 'PATCH');
    expect(patchReq?.path).toBe(`/api/v1/organization/${org.id}/settings`);
    expect(patchReq?.body).toEqual([
      { key: 'general.defaultTimezone', value: 'Zone/City_2', disabled: false },
      { key: 'general.featureEnabled', value: true },
      { key: 'general.maxRetries', value: 7 },
      { key: 'general.topics', value: ['alerts', 'billing'] },
    ]);
  });

  it('calls single DELETE /api/v1/setting/{id} when Reset is clicked on a stored setting', async () => {
    const { entity: user } = await buildUser();
    const { entity: org } = await buildOrganization();
    const { entity: adminMember } = await buildOrganizationUser(
      { role: Role.admin },
      { user, organization: org },
    );
    const serializedOrg = org.__serialize();
    const orgContext = {
      type: 'organization',
      organization: serializedOrg,
    } as unknown as AuthenticatedContext;

    await installRealSession({
      user: user.__serialize(),
      organizations: [serializedOrg],
      organizationUsers: [adminMember.__serialize()],
      context: orgContext,
    });

    const { entity: localeRow } = await buildSetting({
      resourceModel: 'Organization',
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'general.displayLocale',
      valueText: 'es',
      disabled: false,
    });
    storedRowsByPath[`/api/v1/organization/${org.id}/settings`] = [
      localeRow.__serialize() as unknown as RawSettingRow,
    ];

    renderSettingTreeView({ context: orgContext, path: 'general' });
    await screen.findByTestId('setting-field-general.displayLocale');

    fireEvent.click(screen.getByRole('button', { name: 'Reset Display Locale to default' }));

    await waitFor(() => expect(requests.some((r) => r.method === 'DELETE')).toBe(true));
    expect(requests.find((r) => r.method === 'DELETE')?.path).toBe(
      `/api/v1/setting/${localeRow.id}`,
    );
  });

  it('evaluates real ReBAC permissions across User, Organization (admin vs member), Space (org owner without SpaceUser row, space admin, space member), OrganizationUser, SpaceUser, Integration, Project, and ProjectIntegration', async () => {
    const { entity: user } = await buildUser();
    const { entity: otherUser } = await buildUser();
    const { entity: org } = await buildOrganization();
    const { entity: space } = await buildSpace({}, { organization: org });
    const serializedUser = user.__serialize();
    const serializedOrg = org.__serialize();
    const serializedSpace = space.__serialize();

    // 1. User context: own settings editable via real db:Setting:manage
    const userContext = { type: 'user' } as AuthenticatedContext;
    await installRealSession({ user: serializedUser, context: userContext });
    renderSettingTreeView({ context: userContext, path: 'general' });
    await screen.findByTestId('setting-field-general.displayLocale');
    expect((screen.getByLabelText('Display Locale') as HTMLSelectElement).disabled).toBe(false);
    cleanup();

    // 2. Organization member: org settings are read-only (disabled, Save/Reset hidden, disabledText shown)
    const { entity: orgMember } = await buildOrganizationUser(
      { role: Role.member },
      { user, organization: org },
    );
    const { entity: orgSettingRow } = await buildSetting({
      resourceModel: 'Organization',
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'general.displayLocale',
      valueText: 'fr',
      disabled: false,
    });
    storedRowsByPath[`/api/v1/organization/${org.id}/settings`] = [
      orgSettingRow.__serialize() as unknown as RawSettingRow,
    ];

    const orgContext = {
      type: 'organization',
      organization: serializedOrg,
    } as unknown as AuthenticatedContext;
    await installRealSession({
      user: serializedUser,
      organizations: [serializedOrg],
      organizationUsers: [orgMember.__serialize()],
      context: orgContext,
    });

    renderSettingTreeView({ context: orgContext, path: 'general', readOnlyMessage: 'Admins only' });
    await screen.findByTestId('setting-field-general.displayLocale');
    expect((screen.getByLabelText('Display Locale') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset Display Locale to default' })).toBeNull();
    expect(screen.getAllByText('Admins only').length).toBeGreaterThan(0);
    cleanup();

    // 3. OrganizationUser (ownedByMyMembership): member CAN edit operate-gated displayLocale,
    //    CANNOT edit manage-gated memberAdminOnly (proves no hardcoded membership bypass!)
    renderSettingTreeView({
      context: orgContext,
      ownership: { ownedByMyMembership: true },
      path: 'general',
    });
    await screen.findByTestId('setting-field-general.displayLocale');
    expect((screen.getByLabelText('Display Locale') as HTMLSelectElement).disabled).toBe(false);
    expect((screen.getByLabelText('Member Admin Flag') as HTMLInputElement).disabled).toBe(true);
    cleanup();

    // 4. Space context: Org Owner with NO SpaceUser row CAN edit Space settings (Space.organization hydrated!)
    const { entity: orgOwner } = await buildOrganizationUser(
      { role: Role.owner },
      { user, organization: org },
    );
    const spaceContext = {
      type: 'space',
      organization: serializedOrg,
      space: serializedSpace,
    } as unknown as AuthenticatedContext;
    await installRealSession({
      user: serializedUser,
      organizations: [serializedOrg],
      organizationUsers: [orgOwner.__serialize()],
      spaces: [serializedSpace],
      spaceUsers: [], // intentionally NO SpaceUser row!
      context: spaceContext,
    });

    renderSettingTreeView({ context: spaceContext, path: 'general' });
    await screen.findByTestId('setting-field-general.displayLocale');
    expect((screen.getByLabelText('Display Locale') as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDefined();
    expect(
      useAppStore
        .getState()
        .permissions.check(...permissionCheckTargetForTenantContext(spaceContext), 'manage'),
    ).toBe(true);
    cleanup();

    // 5. Space member: Space settings read-only, SpaceUser (ownedByMyMembership) displayLocale editable
    const { entity: spaceMember } = await buildSpaceUser(
      { role: Role.member },
      { user, organization: org, space },
    );
    await installRealSession({
      user: serializedUser,
      organizations: [serializedOrg],
      organizationUsers: [orgMember.__serialize()],
      spaces: [serializedSpace],
      spaceUsers: [spaceMember.__serialize()],
      context: spaceContext,
    });

    renderSettingTreeView({ context: spaceContext, path: 'general' });
    await screen.findByTestId('setting-field-general.displayLocale');
    expect((screen.getByLabelText('Display Locale') as HTMLSelectElement).disabled).toBe(true);
    cleanup();

    renderSettingTreeView({
      context: spaceContext,
      ownership: { ownedByMyMembership: true },
      path: 'general',
    });
    await screen.findByTestId('setting-field-general.displayLocale');
    expect((screen.getByLabelText('Display Locale') as HTMLSelectElement).disabled).toBe(false);
    cleanup();

    // 6. Integration targets (flat scalar records hydrated from Zustand):
    //    a) Personal integration owned by current user -> editable
    const { entity: personalIntegration } = await buildIntegration({
      ownerModel: 'User',
      userId: user.id,
    });
    renderSettingTreeView({
      target: {
        model: 'Integration',
        id: personalIntegration.id,
        record: personalIntegration.__serialize() as unknown as HydratedRecord,
      },
      path: 'general',
    });
    await screen.findByTestId('setting-field-general.featureEnabled');
    expect((screen.getByLabelText('Feature Enabled') as HTMLInputElement).disabled).toBe(false);
    cleanup();

    //    b) Org integration viewed by org member -> read-only; viewed by org admin -> editable
    const { entity: orgIntegration } = await buildIntegration({
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    renderSettingTreeView({
      target: {
        model: 'Integration',
        id: orgIntegration.id,
        record: orgIntegration.__serialize() as unknown as HydratedRecord,
      },
      path: 'general',
    });
    await screen.findByTestId('setting-field-general.featureEnabled');
    expect((screen.getByLabelText('Feature Enabled') as HTMLInputElement).disabled).toBe(true);
    cleanup();

    //    c) Missing target.record fails closed even for org owner!
    await installRealSession({
      user: serializedUser,
      organizations: [serializedOrg],
      organizationUsers: [orgOwner.__serialize()],
      spaces: [serializedSpace],
      context: orgContext,
    });
    renderSettingTreeView({
      target: { model: 'Integration', id: orgIntegration.id },
      path: 'general',
    });
    await screen.findByTestId('setting-field-general.featureEnabled');
    expect((screen.getByLabelText('Feature Enabled') as HTMLInputElement).disabled).toBe(true);
    cleanup();

    //    d) Org owner with hydrated flat orgIntegration -> editable; personal integration of another user -> read-only
    renderSettingTreeView({
      target: {
        model: 'Integration',
        id: orgIntegration.id,
        record: orgIntegration.__serialize() as unknown as HydratedRecord,
      },
      path: 'general',
    });
    await screen.findByTestId('setting-field-general.featureEnabled');
    expect((screen.getByLabelText('Feature Enabled') as HTMLInputElement).disabled).toBe(false);
    cleanup();

    const { entity: otherUserIntegration } = await buildIntegration({
      ownerModel: 'User',
      userId: otherUser.id,
    });
    renderSettingTreeView({
      target: {
        model: 'Integration',
        id: otherUserIntegration.id,
        record: otherUserIntegration.__serialize() as unknown as HydratedRecord,
      },
      path: 'general',
    });
    await screen.findByTestId('setting-field-general.featureEnabled');
    expect((screen.getByLabelText('Feature Enabled') as HTMLInputElement).disabled).toBe(true);
    cleanup();

    // 7. Project & ProjectIntegration targets with flat scalar records -> hydrated and editable for org owner
    const { entity: spaceProject } = await buildProject({
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });
    const { entity: pi } = await buildProjectIntegration(
      {},
      { project: spaceProject, integration: orgIntegration },
    );

    renderSettingTreeView({
      target: {
        model: 'Project',
        id: spaceProject.id,
        record: spaceProject.__serialize() as unknown as HydratedRecord,
      },
      path: 'general',
    });
    await screen.findByTestId('setting-field-general.defaultTimezone');
    expect(
      (
        within(screen.getByTestId('setting-field-general.defaultTimezone')).getByRole('combobox', {
          name: 'Default Timezone',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    cleanup();

    renderSettingTreeView({
      target: {
        model: 'ProjectIntegration',
        id: pi.id,
        record: {
          ...pi.__serialize(),
          project: spaceProject.__serialize(),
        } as unknown as HydratedRecord,
      },
      path: 'general',
    });
    await screen.findByTestId('setting-field-general.featureEnabled');
    expect((screen.getByLabelText('Feature Enabled') as HTMLInputElement).disabled).toBe(false);
  });
});
