import { describe, expect, it } from 'bun:test';
import {
  assembleResourceSettings,
  diffSettingDrafts,
  type RawSettingRow,
  type SettingCatalog,
} from '@template/shared/settings';

const syntheticCatalog: SettingCatalog = {
  categories: {
    general: { key: 'general', label: 'General', description: 'General settings', order: 10 },
    advanced: { key: 'advanced', label: 'Advanced', description: 'Advanced settings', order: 20 },
  },
  definitions: {
    'advanced.snoozeUntil': {
      key: 'advanced.snoozeUntil',
      category: 'advanced',
      label: 'Snooze Until',
      description: 'Pause until timestamp',
      resourceModels: ['Organization'],
      valueType: 'date',
      schema: { type: 'string', format: 'date-time' },
      defaultValue: null,
      order: 20,
      permission: 'manage',
    },
    'advanced.topics': {
      key: 'advanced.topics',
      category: 'advanced',
      label: 'Topics',
      description: 'Subscribed topics',
      resourceModels: ['Organization'],
      valueType: 'multiSelect',
      schema: { type: 'array', items: { type: 'string', enum: ['a', 'b', 'c'] } },
      defaultValue: ['a', 'b'],
      order: 10,
      permission: 'manage',
    },
    'general.defaultTimezone': {
      key: 'general.defaultTimezone',
      category: 'general',
      label: 'Default Timezone',
      description: 'IANA timezone',
      resourceModels: ['Organization', 'User'],
      valueType: 'text',
      schema: { type: 'string', enum: ['UTC', 'America/New_York'] },
      defaultValue: 'UTC',
      order: 10,
      permission: 'manage',
    },
    'general.displayLocale': {
      key: 'general.displayLocale',
      category: 'general',
      label: 'Display Locale',
      description: 'Language code',
      resourceModels: ['Organization', 'OrganizationUser'],
      valueType: 'text',
      schema: { type: 'string', enum: ['en', 'es'] },
      defaultValue: 'en',
      order: 20,
      permission: { default: 'manage', OrganizationUser: 'operate' },
      readPermission: { default: 'read', OrganizationUser: 'operate' },
    },
  },
};

describe('assembleResourceSettings & diffSettingDrafts', () => {
  it('merges raw Setting rows (Date and ISO string dates) with defaults, respects disabled, and sorts by category + setting order', () => {
    const snoozeIso = '2026-12-31T23:59:00.000Z';
    const rawRows: RawSettingRow[] = [
      {
        id: 'set-tz',
        key: 'general.defaultTimezone',
        disabled: true,
        valueBoolean: null,
        valueText: 'America/New_York',
        valueNumber: null,
        valueDate: null,
        valueJson: null,
        updatedAt: '2026-11-22T00:00:00.000Z',
      },
      {
        id: 'set-snooze',
        key: 'advanced.snoozeUntil',
        disabled: false,
        valueBoolean: null,
        valueText: null,
        valueNumber: null,
        valueDate: snoozeIso,
        valueJson: null,
        updatedAt: new Date('2026-11-22T01:00:00.000Z'),
      },
      {
        id: 'set-topics',
        key: 'advanced.topics',
        disabled: false,
        valueBoolean: null,
        valueText: null,
        valueNumber: null,
        valueDate: null,
        valueJson: ['c', 'a'],
        updatedAt: null,
      },
    ];

    const assembled = assembleResourceSettings(syntheticCatalog, rawRows, 'Organization');
    expect(assembled.items.map((item) => item.key)).toEqual([
      'general.defaultTimezone',
      'general.displayLocale',
      'advanced.topics',
      'advanced.snoozeUntil',
    ]);
    expect(Object.keys(assembled.byCategory)).toEqual(['general', 'advanced']);

    // Disabled row falls back to defaultValue while preserving storedValue and settingId
    expect(assembled.items[0]).toMatchObject({
      key: 'general.defaultTimezone',
      value: 'UTC',
      storedValue: 'America/New_York',
      disabled: true,
      isDefault: true,
      settingId: 'set-tz',
    });
    expect(assembled.items[0]?.updatedAt).toBeInstanceOf(Date);

    // Absent row falls back to defaultValue with settingId: null
    expect(assembled.items[1]).toMatchObject({
      key: 'general.displayLocale',
      value: 'en',
      storedValue: null,
      isDefault: true,
      settingId: null,
      permission: 'manage',
      readPermission: 'read',
    });

    // MultiSelect canonicalized, ISO string valueDate parsed to Date
    expect(assembled.items[2]?.value).toEqual(['a', 'c']);
    expect((assembled.items[3]?.value as Date).toISOString()).toBe(snoozeIso);
  });

  it('resolves per-model permission specs and filters by category and keys', () => {
    const memberAssembled = assembleResourceSettings(syntheticCatalog, [], 'OrganizationUser', {
      category: 'general',
    });
    expect(memberAssembled.items.map((i) => i.key)).toEqual(['general.displayLocale']);
    expect(memberAssembled.items[0]).toMatchObject({
      permission: 'operate',
      readPermission: 'operate',
    });

    const filteredByKey = assembleResourceSettings(syntheticCatalog, [], 'Organization', {
      keys: ['advanced.topics'],
    });
    expect(filteredByKey.items.map((i) => i.key)).toEqual(['advanced.topics']);
  });

  it('diffSettingDrafts emits only genuinely dirty keys with canonical multiSelect and ISO date comparisons', () => {
    const snoozeIso = '2026-12-31T23:59:00.000Z';
    const assembled = assembleResourceSettings(
      syntheticCatalog,
      [
        {
          id: 'set-snooze',
          key: 'advanced.snoozeUntil',
          disabled: false,
          valueBoolean: null,
          valueText: null,
          valueNumber: null,
          valueDate: snoozeIso,
          valueJson: null,
        },
      ],
      'Organization',
    );

    const dirty = diffSettingDrafts(assembled.items, {
      'general.defaultTimezone': 'UTC', // unchanged default
      'general.displayLocale': 'es', // changed
      'advanced.topics': ['b', 'a', 'b'], // reordered duplicate equal to default ['a', 'b'] -> NOT dirty
      'advanced.snoozeUntil': new Date(snoozeIso), // same instant as ISO string -> NOT dirty
    });

    expect(dirty).toEqual([{ key: 'general.displayLocale', value: 'es' }]);

    const dirtyDateAndMulti = diffSettingDrafts(assembled.items, {
      'advanced.topics': ['c', 'a', 'c'],
      'advanced.snoozeUntil': new Date('2027-01-01T00:00:00.000Z'),
    });
    expect(dirtyDateAndMulti).toEqual([
      { key: 'advanced.topics', value: ['a', 'c'] },
      { key: 'advanced.snoozeUntil', value: '2027-01-01T00:00:00.000Z' },
    ]);

    // Saving a new value over a disabled: true row explicitly re-enables it (disabled: false)
    const disabledAssembled = assembleResourceSettings(
      syntheticCatalog,
      [
        {
          id: 'set-disabled-tz',
          key: 'general.defaultTimezone',
          disabled: true,
          valueBoolean: null,
          valueText: 'America/New_York',
          valueNumber: null,
          valueDate: null,
          valueJson: null,
        },
      ],
      'Organization',
    );
    expect(
      diffSettingDrafts(disabledAssembled.items, {
        'general.defaultTimezone': 'America/New_York',
      }),
    ).toEqual([{ key: 'general.defaultTimezone', value: 'America/New_York', disabled: false }]);
  });
});
