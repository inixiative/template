import { describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { validateAttributeValue } from '@template/shared/attributes';
import {
  SETTING_RESOURCE_MODELS,
  SETTING_TREES,
  type SettingKeyOf,
  type SettingTree,
  settingAt,
  settingsIn,
} from '@template/shared/settings';
import { isEqual } from 'lodash-es';

const boxes = (label: string, defaultValue: number) => ({
  valueType: 'number' as const,
  defaultValue,
  conditions: {
    field: 'value',
    operator: Operator.greaterThanEquals,
    value: 0,
    error: 'At least 0',
  },
  label,
  description: label,
});
const cacheBlock = { boxesMin: boxes('Minimum boxes', 0), boxesMax: boxes('Maximum boxes', 1) };

const tree: SettingTree = {
  __read: 'read',
  __manage: 'manage',
  notifications: {
    enabled: { valueType: 'boolean', defaultValue: true, label: 'Notify', description: 'Notify.' },
  },
  'provider:linear': {
    __manage: 'own',
    linear: {
      __label: 'Linear',
      l1: cacheBlock,
      l2: { keep: cacheBlock, full: cacheBlock },
      paused: {
        valueType: 'boolean',
        defaultValue: false,
        label: 'Paused',
        description: 'Pause sync.',
        __manage: 'operate',
      },
    },
  },
};

describe('settingAt', () => {
  it('reads the leaf at a full path, walking up for the nearest __read and __manage', () => {
    expect(settingAt(tree, 'notifications.enabled', {})).toMatchObject({
      key: 'notifications.enabled',
      read: 'read',
      manage: 'manage',
    });
    expect(settingAt(tree, 'linear.l2.full.boxesMax', { provider: 'linear' })).toMatchObject({
      read: 'read',
      manage: 'own',
      defaultValue: 1,
    });
    expect(settingAt(tree, 'linear.paused', { provider: 'linear' })).toMatchObject({
      manage: 'operate',
    });
  });

  it('finds nothing at a branch, a missing path, or a kind the resource is not', () => {
    expect(settingAt(tree, 'linear.l1', { provider: 'linear' })).toBeUndefined();
    expect(settingAt(tree, 'notifications.missing', {})).toBeUndefined();
    expect(settingAt(tree, 'linear.paused', { provider: 'slack' })).toBeUndefined();
    expect(settingAt(tree, 'notifications.enabled.deeper', {})).toBeUndefined();
  });

  it("keeps each branch's permissions on its own settings when kinds merge into a plain branch", () => {
    const merging: SettingTree = {
      __read: 'read',
      __manage: 'manage',
      general: { __manage: 'own', a: boxes('A', 0) },
      'provider:chorus': { __manage: 'operate', general: { b: boxes('B', 0) } },
    };
    const kinds = { provider: 'chorus' };
    expect(settingAt(merging, 'general.a', kinds)?.manage).toBe('own');
    expect(settingAt(merging, 'general.b', kinds)?.manage).toBe('operate');
    expect(settingsIn(merging, 'every').map(({ key, manage }) => `${key}:${manage}`)).toEqual([
      'general.a:own',
      'general.b:operate',
    ]);
  });

  it('merges same-named branches at every depth', () => {
    const deep: SettingTree = {
      __read: 'read',
      __manage: 'manage',
      general: { l1: { x: boxes('X', 0) } },
      'provider:chorus': { general: { l1: { y: boxes('Y', 0) } } },
    };
    expect(settingsIn(deep, { provider: 'chorus' }).map(({ key }) => key)).toEqual([
      'general.l1.x',
      'general.l1.y',
    ]);
  });
});

describe('settingsIn', () => {
  it('lists every setting a resource holds, by path, in declaration order', () => {
    expect(settingsIn(tree, { provider: 'linear' }).map(({ key }) => key)).toEqual([
      'notifications.enabled',
      'linear.l1.boxesMin',
      'linear.l1.boxesMax',
      'linear.l2.keep.boxesMin',
      'linear.l2.keep.boxesMax',
      'linear.l2.full.boxesMin',
      'linear.l2.full.boxesMax',
      'linear.paused',
    ]);
    expect(settingsIn(tree, {}).map(({ key }) => key)).toEqual(['notifications.enabled']);
  });
});

describe('SETTING_TREES', () => {
  const everySettingOfModel = SETTING_RESOURCE_MODELS.flatMap((model) =>
    settingsIn(SETTING_TREES[model], 'every').map((setting) => ({ model, setting })),
  );

  it('names settings and branches plainly: no `:` inside a name, not integer-like', () => {
    for (const { setting } of everySettingOfModel)
      for (const segment of setting.key.split('.')) {
        expect(segment.includes(':')).toBe(false);
        expect(/^\d+$/.test(segment)).toBe(false);
      }
  });

  it('gives a key one meaning wherever it is placed', () => {
    for (const { setting } of everySettingOfModel)
      for (const other of everySettingOfModel.filter(
        (settingOfModel) => settingOfModel.setting.key === setting.key,
      )) {
        expect(other.setting.valueType).toBe(setting.valueType);
        expect(isEqual(other.setting.options, setting.options)).toBe(true);
        expect(isEqual(other.setting.conditions, setting.conditions)).toBe(true);
        expect(isEqual(other.setting.defaultValue, setting.defaultValue)).toBe(true);
      }
  });

  it('gives a key one permission per model across its kinds', () => {
    for (const { model, setting } of everySettingOfModel)
      for (const other of everySettingOfModel.filter(
        (settingOfModel) =>
          settingOfModel.model === model && settingOfModel.setting.key === setting.key,
      )) {
        expect(other.setting.read).toBe(setting.read);
        expect(other.setting.manage).toBe(setting.manage);
      }
  });

  it('holds a default that passes its own type, options and conditions', () => {
    for (const { setting } of everySettingOfModel)
      if (setting.defaultValue !== null)
        expect(() =>
          validateAttributeValue(setting.valueType, setting.defaultValue, setting),
        ).not.toThrow();
  });

  it('ships timezone and display language where they belong, with options', () => {
    expect(settingsIn(SETTING_TREES.User, {}).map(({ key }) => key)).toEqual([
      'general.defaultTimezone',
      'general.displayLocale',
    ]);
    expect(settingsIn(SETTING_TREES.Project, {}).map(({ key }) => key)).toEqual([
      'general.defaultTimezone',
    ]);
    expect(settingAt(SETTING_TREES.OrganizationUser, 'general.displayLocale', {})).toMatchObject({
      read: 'operate',
      manage: 'operate',
    });
    expect(settingAt(SETTING_TREES.User, 'general.displayLocale', {})?.options).toContainEqual({
      value: 'en',
      label: 'English',
    });
  });

  it("types each model's keys from its tree", () => {
    const projectKey: SettingKeyOf<'Project'> = 'general.defaultTimezone';
    // @ts-expect-error displayLocale is not on Project's tree
    const notOnProject: SettingKeyOf<'Project'> = 'general.displayLocale';
    expect([projectKey, notOnProject]).toHaveLength(2);
  });
});
