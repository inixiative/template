/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared
 * @uses none
 */
import {
  SETTING_RESOURCE_MODELS,
  type SettingResourceModelName,
} from '@template/shared/settings/resourceModels';
import { settingDefinitionsInTree } from '@template/shared/settings/settingDefinitionsInTree';
import { settingTreeEntries } from '@template/shared/settings/settingTreeNodes';
import { SETTING_TREES } from '@template/shared/settings/trees';
import type {
  SettingBranch,
  SettingDefinition,
  SettingResourceKinds,
  SettingTrees,
} from '@template/shared/settings/types';
import { mapValues, uniq } from 'lodash-es';
import { z } from 'zod';

const kindFieldsIn = (branch: SettingBranch): string[] =>
  settingTreeEntries(branch).flatMap((entry) => {
    if (entry.kind === 'kind') return [entry.field, ...kindFieldsIn(entry.node)];
    if (entry.kind === 'branch') return kindFieldsIn(entry.node);
    return [];
  });

const trees: SettingTrees = SETTING_TREES;

export const SETTING_KIND_FIELDS: Record<SettingResourceModelName, readonly string[]> = mapValues(
  trees,
  (tree) => uniq(kindFieldsIn(tree)),
);

const definitionsHeldByModel: Record<SettingResourceModelName, SettingDefinition[]> = mapValues(
  trees,
  (tree) => settingDefinitionsInTree(tree, 'every'),
);

const definitionByKey = new Map<string, SettingDefinition>();
for (const model of SETTING_RESOURCE_MODELS)
  for (const definition of definitionsHeldByModel[model])
    if (!definitionByKey.has(definition.key)) definitionByKey.set(definition.key, definition);

export const SETTING_KEYS = [...definitionByKey.keys()];

export const SettingKeySchema = z.string().refine((key) => definitionByKey.has(key), {
  message: 'Unknown setting key',
});

/** What `key` means (type, schema, default, label): one meaning wherever the key is placed. */
export const settingDefinitionForKey = (key: string): SettingDefinition | undefined =>
  definitionByKey.get(key);

/** Every setting the resource's tree holds for its kinds, in declaration order. */
export const settingDefinitionsForResource = (
  resourceModel: SettingResourceModelName,
  kinds: SettingResourceKinds,
): SettingDefinition[] => settingDefinitionsInTree(trees[resourceModel], kinds);

export const settingDefinitionForResource = (
  resourceModel: SettingResourceModelName,
  kinds: SettingResourceKinds,
  key: string,
): SettingDefinition | undefined =>
  settingDefinitionsForResource(resourceModel, kinds).find((definition) => definition.key === key);

/** Every placement a model's tree can hold, across all of its `field:value` kinds. */
export const settingDefinitionsHeldByModel = (
  resourceModel: SettingResourceModelName,
): readonly SettingDefinition[] => definitionsHeldByModel[resourceModel];
