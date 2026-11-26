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
import { SETTING_TREES } from '@template/shared/settings/trees';
import type {
  SettingDefinition,
  SettingResourceKinds,
  SettingTrees,
} from '@template/shared/settings/types';
import { mapValues } from 'lodash-es';
import { z } from 'zod';

const trees: SettingTrees = SETTING_TREES;

const definitionsHeldByModel: Record<SettingResourceModelName, SettingDefinition[]> = mapValues(
  trees,
  (tree) => settingDefinitionsInTree(tree, 'every'),
);

const definitionByKey = new Map<string, SettingDefinition>();
for (const model of SETTING_RESOURCE_MODELS)
  for (const definition of definitionsHeldByModel[model])
    if (!definitionByKey.has(definition.key)) definitionByKey.set(definition.key, definition);

export const SettingKeySchema = z.string().refine((key) => definitionByKey.has(key), {
  message: 'Unknown setting key',
});

export const settingDefinitionForKey = (key: string): SettingDefinition | undefined =>
  definitionByKey.get(key);

export const settingDefinitionsForResource = (
  resourceModel: SettingResourceModelName,
  kinds: SettingResourceKinds,
): SettingDefinition[] => settingDefinitionsInTree(trees[resourceModel], kinds);

export const settingDefinitionsHeldByModel = (
  resourceModel: SettingResourceModelName,
): readonly SettingDefinition[] => definitionsHeldByModel[resourceModel];
