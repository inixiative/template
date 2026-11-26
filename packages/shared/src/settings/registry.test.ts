import { describe, expect, it } from 'bun:test';
import { encodeAttributeValue, validateAttributeTypedColumns } from '@template/shared/attributes';
import {
  SETTING_PERMISSION_ACTIONS,
  SETTING_RESOURCE_MODELS,
  SETTING_TREES,
  type SettingBranch,
  type SettingResourceKinds,
  type SettingTree,
  settingDefinitionForKey,
  settingDefinitionForResource,
  settingDefinitionsForResource,
  settingDefinitionsHeldByModel,
  settingDefinitionsInTree,
  settingTreeEntries,
} from '@template/shared/settings';
import { isEqual } from 'lodash-es';
import { z } from 'zod';

const settingNamesIn = (branch: SettingBranch): string[] =>
  settingTreeEntries(branch).flatMap((entry) => {
    if (entry.kind === 'meta') return [];
    if (entry.kind === 'kind') return settingNamesIn(entry.node);
    if (entry.kind === 'leaf') return [entry.name];
    return [entry.name, ...settingNamesIn(entry.node)];
  });

const kindValuesIn = (branch: SettingBranch, into: Record<string, Set<string>> = {}) => {
  for (const entry of settingTreeEntries(branch)) {
    if (entry.kind === 'kind') {
      into[entry.field] = new Set([...(into[entry.field] ?? []), entry.value]);
      kindValuesIn(entry.node, into);
    }
    if (entry.kind === 'branch') kindValuesIn(entry.node, into);
  }
  return into;
};

const everyKindAssignment = (tree: SettingTree): SettingResourceKinds[] =>
  Object.entries(kindValuesIn(tree)).reduce<SettingResourceKinds[]>(
    (assignments, [field, values]) =>
      assignments.flatMap((assignment) => [
        assignment,
        ...[...values].map((value) => ({ ...assignment, [field]: value })),
      ]),
    [{}],
  );

const keysDeclaredTwiceIn = (tree: SettingTree): string[] =>
  everyKindAssignment(tree).flatMap((kinds) => {
    const keys = settingDefinitionsInTree(tree, kinds).map((definition) => definition.key);
    return keys.filter((key, index) => keys.indexOf(key) !== index);
  });

describe('SETTING_TREES rules', () => {
  it('names every setting and branch with a plain name: no `__` prefix, no `:`, not integer-like', () => {
    for (const model of SETTING_RESOURCE_MODELS)
      for (const name of settingNamesIn(SETTING_TREES[model])) {
        expect(name.startsWith('__')).toBe(false);
        expect(name.includes(':')).toBe(false);
        expect(/^\d+$/.test(name)).toBe(false);
      }
  });

  it('resolves both a read and a manage permission for every setting', () => {
    for (const model of SETTING_RESOURCE_MODELS)
      for (const definition of settingDefinitionsHeldByModel(model)) {
        expect(SETTING_PERMISSION_ACTIONS).toContain(definition.read);
        expect(SETTING_PERMISSION_ACTIONS).toContain(definition.manage);
      }
  });

  it('gives a key one meaning in every tree it appears in', () => {
    for (const model of SETTING_RESOURCE_MODELS)
      for (const definition of settingDefinitionsHeldByModel(model)) {
        const meaning = settingDefinitionForKey(definition.key);
        expect(meaning?.valueType).toBe(definition.valueType);
        expect(meaning?.schema).toBe(definition.schema);
        expect(isEqual(meaning?.defaultValue, definition.defaultValue)).toBe(true);
      }
  });

  it('declares each key once for any one resource, whatever its kinds', () => {
    for (const model of SETTING_RESOURCE_MODELS)
      expect(keysDeclaredTwiceIn(SETTING_TREES[model])).toEqual([]);
  });

  it('gives a key one permission per model across its kinds', () => {
    for (const model of SETTING_RESOURCE_MODELS) {
      const held = settingDefinitionsHeldByModel(model);
      for (const definition of held)
        for (const other of held.filter((candidate) => candidate.key === definition.key)) {
          expect(other.read).toBe(definition.read);
          expect(other.manage).toBe(definition.manage);
        }
    }
  });

  it('validates every non-null default under its value type and schema', () => {
    for (const model of SETTING_RESOURCE_MODELS)
      for (const definition of settingDefinitionsHeldByModel(model)) {
        if (definition.defaultValue === null) continue;
        expect(() =>
          validateAttributeTypedColumns(
            definition.valueType,
            encodeAttributeValue(definition.valueType, definition.defaultValue),
            definition.schema,
          ),
        ).not.toThrow();
      }
  });
});

describe('compiling a setting tree', () => {
  const cacheBlock = {
    boxesMin: {
      valueType: 'number',
      schema: z.number().int(),
      defaultValue: 0,
      label: 'Minimum boxes',
      description: 'Fewest boxes.',
    },
    boxesMax: {
      valueType: 'number',
      schema: z.number().int(),
      defaultValue: 1,
      label: 'Maximum boxes',
      description: 'Most boxes.',
    },
  } as const;

  const tree: SettingTree = {
    __read: 'read',
    __manage: 'manage',
    notifications: {
      enabled: {
        valueType: 'boolean',
        schema: z.boolean(),
        defaultValue: true,
        label: 'Notify',
        description: 'Send notifications.',
      },
    },
    'provider:linear': {
      __manage: 'own',
      linear: {
        __label: 'Linear',
        l1: cacheBlock,
        l2: { keep: cacheBlock, full: cacheBlock },
        paused: {
          valueType: 'boolean',
          schema: z.boolean(),
          defaultValue: false,
          label: 'Paused',
          description: 'Pause sync.',
          __manage: 'operate',
        },
      },
    },
  };

  it('keys each leaf by its path, skipping kind branches, in declaration order', () => {
    expect(settingDefinitionsInTree(tree, { provider: 'linear' }).map(({ key }) => key)).toEqual([
      'notifications.enabled',
      'linear.l1.boxesMin',
      'linear.l1.boxesMax',
      'linear.l2.keep.boxesMin',
      'linear.l2.keep.boxesMax',
      'linear.l2.full.boxesMin',
      'linear.l2.full.boxesMax',
      'linear.paused',
    ]);
  });

  it('finds a key placed twice for one resource', () => {
    expect(
      keysDeclaredTwiceIn({
        ...tree,
        'provider:linear': { linear: { l1: cacheBlock } },
        linear: { l1: cacheBlock },
      }),
    ).toContain('linear.l1.boxesMin');
  });

  it('allows one key in sibling kinds of the same field', () => {
    expect(
      keysDeclaredTwiceIn({
        __read: 'read',
        __manage: 'manage',
        'provider:jira': { atlassian: { l1: cacheBlock } },
        'provider:confluence': { atlassian: { l1: cacheBlock } },
      }),
    ).toEqual([]);
  });

  it('holds only the settings outside kind branches for another kind or none', () => {
    expect(settingDefinitionsInTree(tree, { provider: 'slack' }).map(({ key }) => key)).toEqual([
      'notifications.enabled',
    ]);
    expect(settingDefinitionsInTree(tree, {}).map(({ key }) => key)).toEqual([
      'notifications.enabled',
    ]);
  });

  it('passes __read and __manage down, the nearest one winning', () => {
    const byKey = Object.fromEntries(
      settingDefinitionsInTree(tree, { provider: 'linear' }).map((definition) => [
        definition.key,
        definition,
      ]),
    );
    expect(byKey['notifications.enabled']).toMatchObject({ read: 'read', manage: 'manage' });
    expect(byKey['linear.l2.full.boxesMax']).toMatchObject({ read: 'read', manage: 'own' });
    expect(byKey['linear.paused']).toMatchObject({ read: 'read', manage: 'operate' });
  });
});

describe('template trees', () => {
  it('ships timezone and display language on the models that hold them', () => {
    expect(settingDefinitionsForResource('User', {}).map(({ key }) => key)).toEqual([
      'general.defaultTimezone',
      'general.displayLocale',
    ]);
    expect(settingDefinitionsForResource('Project', {}).map(({ key }) => key)).toEqual([
      'general.defaultTimezone',
    ]);
    expect(settingDefinitionsForResource('OrganizationUser', {})).toEqual([
      expect.objectContaining({
        key: 'general.displayLocale',
        read: 'operate',
        manage: 'operate',
      }),
    ]);
  });

  it('finds a definition only on a resource whose tree holds it', () => {
    expect(settingDefinitionForResource('Organization', {}, 'general.displayLocale')).toBeDefined();
    expect(settingDefinitionForResource('Project', {}, 'general.displayLocale')).toBeUndefined();
  });
});
