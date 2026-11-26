import { describe, expect, it } from 'bun:test';
import {
  assembleResourceSettings,
  diffSettingDrafts,
  type RawSettingRow,
  type SettingCatalog,
  type SettingTree,
} from '@template/shared/settings';

const emptyTree: SettingTree = { __read: 'read', __manage: 'manage' };

const organizationTree: SettingTree = {
  __read: 'read',
  __manage: 'manage',
  general: {
    __label: 'General',
    defaultTimezone: {
      valueType: 'text',
      options: ['UTC', 'America/New_York'].map((value) => ({ value, label: value })),
      defaultValue: 'UTC',
      label: 'Default Timezone',
      description: 'IANA timezone',
    },
    displayLocale: {
      valueType: 'text',
      options: ['en', 'es'].map((value) => ({ value, label: value })),
      defaultValue: 'en',
      label: 'Display Locale',
      description: 'Language code',
    },
  },
  advanced: {
    __label: 'Advanced',
    topics: {
      valueType: 'multiSelect',
      options: ['a', 'b', 'c'].map((value) => ({ value, label: value })),
      defaultValue: ['a', 'b'],
      label: 'Topics',
      description: 'Subscribed topics',
    },
    snoozeUntil: {
      valueType: 'date',
      defaultValue: null,
      label: 'Snooze Until',
      description: 'Pause until timestamp',
    },
  },
};

const catalog: SettingCatalog = {
  trees: {
    User: emptyTree,
    Organization: organizationTree,
    Space: emptyTree,
    OrganizationUser: {
      __read: 'operate',
      __manage: 'operate',
      general: {
        displayLocale: (organizationTree.general as SettingTree).displayLocale,
      },
    },
    SpaceUser: emptyTree,
    Project: emptyTree,
    Integration: {
      __read: 'read',
      __manage: 'manage',
      'provider:linear': {
        linear: {
          paused: {
            valueType: 'boolean',
            defaultValue: false,
            label: 'Paused',
            description: 'Pause sync.',
          },
        },
      },
    },
    ProjectIntegration: emptyTree,
  },
};

const row = (
  overrides: Partial<RawSettingRow> & Pick<RawSettingRow, 'id' | 'key'>,
): RawSettingRow => ({
  disabled: false,
  valueBoolean: null,
  valueText: null,
  valueNumber: null,
  valueDate: null,
  valueJson: null,
  ...overrides,
});

describe('assembleResourceSettings', () => {
  it('lists the tree in declaration order and merges rows with defaults, respecting disabled', () => {
    const snoozeIso = '2026-12-31T23:59:00.000Z';
    const items = assembleResourceSettings(
      catalog,
      [
        row({
          id: 'set-tz',
          key: 'general.defaultTimezone',
          disabled: true,
          valueText: 'America/New_York',
          updatedAt: '2026-11-22T00:00:00.000Z',
        }),
        row({ id: 'set-snooze', key: 'advanced.snoozeUntil', valueDate: snoozeIso }),
        row({ id: 'set-topics', key: 'advanced.topics', valueJson: ['c', 'a'] }),
      ],
      'Organization',
    );

    expect(items.map((item) => item.key)).toEqual([
      'general.defaultTimezone',
      'general.displayLocale',
      'advanced.topics',
      'advanced.snoozeUntil',
    ]);
    expect(items[0]).toMatchObject({
      value: 'UTC',
      storedValue: 'America/New_York',
      disabled: true,
      isDefault: true,
      settingId: 'set-tz',
    });
    expect(items[0]?.updatedAt).toBeInstanceOf(Date);
    expect(items[1]).toMatchObject({
      value: 'en',
      storedValue: null,
      isDefault: true,
      settingId: null,
      read: 'read',
      manage: 'manage',
    });
    expect(items[2]?.value).toEqual(['a', 'c']);
    expect((items[3]?.value as Date).toISOString()).toBe(snoozeIso);
  });

  it('takes permissions from the resource tree and filters by path and keys', () => {
    expect(assembleResourceSettings(catalog, [], 'OrganizationUser')).toEqual([
      expect.objectContaining({ key: 'general.displayLocale', read: 'operate', manage: 'operate' }),
    ]);
    expect(
      assembleResourceSettings(catalog, [], 'Organization', { path: 'advanced' }).map(
        (item) => item.key,
      ),
    ).toEqual(['advanced.topics', 'advanced.snoozeUntil']);
    expect(
      assembleResourceSettings(catalog, [], 'Organization', { keys: ['advanced.topics'] }).map(
        (item) => item.key,
      ),
    ).toEqual(['advanced.topics']);
  });

  it('holds a kind branch only for a resource of that kind', () => {
    expect(
      assembleResourceSettings(catalog, [], 'Integration', { kinds: { provider: 'linear' } }).map(
        (item) => item.key,
      ),
    ).toEqual(['linear.paused']);
    expect(
      assembleResourceSettings(catalog, [], 'Integration', { kinds: { provider: 'slack' } }),
    ).toEqual([]);
  });
});

describe('diffSettingDrafts', () => {
  it('emits only dirty keys, comparing multiSelect canonically and dates by instant', () => {
    const snoozeIso = '2026-12-31T23:59:00.000Z';
    const items = assembleResourceSettings(
      catalog,
      [row({ id: 'set-snooze', key: 'advanced.snoozeUntil', valueDate: snoozeIso })],
      'Organization',
    );

    expect(
      diffSettingDrafts(items, {
        'general.defaultTimezone': 'UTC',
        'general.displayLocale': 'es',
        'advanced.topics': ['b', 'a', 'b'],
        'advanced.snoozeUntil': new Date(snoozeIso),
      }),
    ).toEqual([{ key: 'general.displayLocale', value: 'es' }]);

    expect(
      diffSettingDrafts(items, {
        'advanced.topics': ['c', 'a', 'c'],
        'advanced.snoozeUntil': new Date('2027-01-01T00:00:00.000Z'),
      }),
    ).toEqual([
      { key: 'advanced.topics', value: ['a', 'c'] },
      { key: 'advanced.snoozeUntil', value: '2027-01-01T00:00:00.000Z' },
    ]);
  });

  it('re-enables a disabled row when a value is saved over it', () => {
    const items = assembleResourceSettings(
      catalog,
      [
        row({
          id: 'set-disabled-tz',
          key: 'general.defaultTimezone',
          disabled: true,
          valueText: 'America/New_York',
        }),
      ],
      'Organization',
    );
    expect(diffSettingDrafts(items, { 'general.defaultTimezone': 'America/New_York' })).toEqual([
      { key: 'general.defaultTimezone', value: 'America/New_York', disabled: false },
    ]);
  });
});
