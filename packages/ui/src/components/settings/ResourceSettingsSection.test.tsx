/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildOrganization, buildSetting, buildUser } from '@template/db/test';
import type { RawSettingRow, SettingCatalog } from '@template/shared/settings';
import { ResourceSettingsSection } from '@template/ui/components/settings/ResourceSettingsSection';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const initialState = useAppStore.getState();

const manyTimezones = Array.from({ length: 15 }, (_, idx) => `Zone/City_${idx}`);
const fullCatalog: SettingCatalog = {
  categories: {
    general: {
      key: 'general',
      label: 'General',
      description: 'Localization and workspace defaults.',
      order: 10,
    },
  },
  definitions: {
    'general.timezone': {
      key: 'general.timezone',
      category: 'general',
      label: 'Timezone',
      description: 'SearchableSelect (> 12 enum options)',
      resourceModels: ['Organization'],
      valueType: 'text',
      schema: { type: 'string', enum: ['UTC', ...manyTimezones] },
      defaultValue: 'UTC',
      order: 10,
      permission: 'manage',
    },
    'general.locale': {
      key: 'general.locale',
      category: 'general',
      label: 'Locale',
      description: 'Select (<= 12 enum options)',
      resourceModels: ['Organization'],
      valueType: 'text',
      schema: { type: 'string', enum: ['en', 'es', 'fr'] },
      defaultValue: 'en',
      order: 20,
      permission: 'manage',
    },
    'general.featureEnabled': {
      key: 'general.featureEnabled',
      category: 'general',
      label: 'Feature Enabled',
      description: 'Boolean toggle',
      resourceModels: ['Organization'],
      valueType: 'boolean',
      schema: { type: 'boolean' },
      defaultValue: false,
      order: 30,
      permission: 'manage',
    },
    'general.maxRetries': {
      key: 'general.maxRetries',
      category: 'general',
      label: 'Max Retries',
      description: 'Numeric input',
      resourceModels: ['Organization'],
      valueType: 'number',
      schema: { type: 'number' },
      defaultValue: 3,
      order: 40,
      permission: 'manage',
    },
    'general.snoozeUntil': {
      key: 'general.snoozeUntil',
      category: 'general',
      label: 'Snooze Until',
      description: 'Date-time input',
      resourceModels: ['Organization'],
      valueType: 'date',
      schema: { type: 'string', format: 'date-time' },
      defaultValue: null,
      order: 50,
      permission: 'manage',
    },
    'general.topics': {
      key: 'general.topics',
      category: 'general',
      label: 'Topics',
      description: 'Multi-select checkbox pills',
      resourceModels: ['Organization'],
      valueType: 'multiSelect',
      schema: { type: 'array', items: { type: 'string', enum: ['alerts', 'billing', 'digest'] } },
      defaultValue: ['alerts'],
      order: 60,
      permission: 'manage',
    },
    'general.extraJson': {
      key: 'general.extraJson',
      category: 'general',
      label: 'Extra Config',
      description: 'Validated JSON textarea',
      resourceModels: ['Organization'],
      valueType: 'json',
      schema: { type: 'object' },
      defaultValue: { mode: 'standard' },
      order: 70,
      permission: 'manage',
    },
  },
};

type RecordedRequest = { method: string; path: string; body: unknown };

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let requests: RecordedRequest[];
let storedRows: RawSettingRow[];
let orgId: string;
let orgContext: AuthenticatedContext;

beforeEach(async () => {
  const { entity: user } = await buildUser();
  const { entity: org } = await buildOrganization();
  orgId = org.id;
  orgContext = {
    type: 'organization',
    organization: org.__serialize(),
  } as unknown as AuthenticatedContext;

  const { entity: localeRow } = await buildSetting({
    resourceModel: 'Organization',
    resourceId: org.id,
    resourceOrganizationId: org.id,
    key: 'general.locale',
    valueText: 'es',
    disabled: false,
  });
  const { entity: disabledTzRow } = await buildSetting({
    resourceModel: 'Organization',
    resourceId: org.id,
    resourceOrganizationId: org.id,
    key: 'general.timezone',
    valueText: 'Zone/City_1',
    disabled: true,
  });

  storedRows = [
    localeRow.__serialize() as unknown as RawSettingRow,
    disabledTzRow.__serialize() as unknown as RawSettingRow,
  ];
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
    if (request.method === 'GET' && path === `/api/v1/organization/${orgId}/settings`) {
      return Response.json({ data: storedRows });
    }
    if (request.method === 'PATCH' && path === `/api/v1/organization/${orgId}/settings`) {
      return Response.json({ data: storedRows });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/v1/setting/')) {
      const deletedId = path.split('/').pop();
      storedRows = storedRows.filter((row) => row.id !== deletedId);
      return new Response(null, { status: 204 });
    }
    return Response.json({ message: 'Unexpected request' }, { status: 400 });
  };

  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );

  useAppStore.setState((state) => ({
    auth: { ...state.auth, user: user.__serialize(), isAuthenticated: true },
    tenant: { ...state.tenant, context: orgContext },
    permissions: {
      ...state.permissions,
      check: (_model, _record, action) => action === 'manage' || action === 'read',
    },
  }));
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  useAppStore.setState(initialState);
  client.clear();
});

const renderSection = (readOnly = false) => {
  if (readOnly) {
    useAppStore.setState((state) => ({
      permissions: {
        ...state.permissions,
        check: (_model, _record, action) => action === 'read',
      },
    }));
  }
  return render(
    <QueryClientProvider client={client}>
      <ResourceSettingsSection
        context={orgContext}
        category="general"
        readOnlyMessage="Admins only"
      />
    </QueryClientProvider>,
  );
};

describe('ResourceSettingsSection & SettingField', () => {
  it('renders all 6 value types (SearchableSelect >12, Select <=12, boolean, number, date, multiSelect, JSON), applies defaults on missing/disabled rows, and batch-saves only dirty keys', async () => {
    renderSection();

    // Wait for master data + raw settings to assemble
    await screen.findByTestId('setting-field-general.timezone');

    // Timezone has > 12 options -> SearchableSelect button (combobox/select), and disabled stored row falls back to default 'UTC'
    const tzField = screen.getByTestId('setting-field-general.timezone');
    expect(within(tzField).getByRole('combobox', { name: 'Timezone' }).textContent).toContain(
      'UTC',
    );
    expect(within(tzField).getByText('Default')).toBeDefined();

    // Locale has <= 12 options -> native <select> with stored value 'es'
    const localeSelect = screen.getByLabelText('Locale') as HTMLSelectElement;
    expect(localeSelect.tagName).toBe('SELECT');
    expect(localeSelect.value).toBe('es');

    // Save button starts disabled until a draft changes
    const saveButton = screen.getByRole('button', { name: 'Save settings' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    // Edit boolean, number, multiSelect, and JSON (plus invalid JSON shows alert without breaking draft)
    fireEvent.click(screen.getByLabelText('Feature Enabled'));
    fireEvent.change(screen.getByLabelText('Max Retries'), { target: { value: '7' } });
    fireEvent.click(
      within(screen.getByTestId('setting-field-general.topics')).getByText('billing'),
    );

    const jsonArea = screen.getByLabelText('Extra Config');
    fireEvent.change(jsonArea, { target: { value: '{not valid json' } });
    expect(screen.getByRole('alert').textContent).toContain('Invalid JSON');
    fireEvent.change(jsonArea, { target: { value: '{"mode":"strict"}' } });
    expect(screen.queryByRole('alert')).toBeNull();

    // Save sends ONLY the 4 dirty keys in a single batch PATCH (not untouched timezone/locale/snoozeUntil)
    expect(saveButton.disabled).toBe(false);
    fireEvent.click(saveButton);

    await waitFor(() => expect(requests.some((r) => r.method === 'PATCH')).toBe(true));
    const patchReq = requests.find((r) => r.method === 'PATCH');
    expect(patchReq?.path).toBe(`/api/v1/organization/${orgId}/settings`);
    expect(patchReq?.body).toEqual([
      { key: 'general.featureEnabled', value: true },
      { key: 'general.maxRetries', value: 7 },
      { key: 'general.topics', value: ['alerts', 'billing'] },
      { key: 'general.extraJson', value: { mode: 'strict' } },
    ]);
  });

  it('calls single DELETE /api/v1/setting/{id} when Reset is clicked on a stored setting', async () => {
    const expectedId = storedRows[0]?.id ?? '';
    renderSection();
    await screen.findByTestId('setting-field-general.locale');

    const resetBtn = screen.getByRole('button', { name: 'Reset Locale to default' });
    fireEvent.click(resetBtn);

    await waitFor(() => expect(requests.some((r) => r.method === 'DELETE')).toBe(true));
    const deleteReq = requests.find((r) => r.method === 'DELETE');
    expect(deleteReq?.path).toBe(`/api/v1/setting/${expectedId}`);
  });

  it('disables all controls, hides Save/Reset, and renders disabledText when caller lacks manage permission', async () => {
    renderSection(true);
    await screen.findByTestId('setting-field-general.locale');

    const localeSelect = screen.getByLabelText('Locale') as HTMLSelectElement;
    expect(localeSelect.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset Locale to default' })).toBeNull();
    expect(screen.getAllByText('Admins only').length).toBeGreaterThan(0);
  });
});
