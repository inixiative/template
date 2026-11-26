/**
 * @atlas
 * @kind utils
 * @partOf feature:setting
 * @uses none
 */
import {
  isSettingLeaf,
  type SettingBranch,
  type SettingJsonSchema,
  type SettingNode,
} from '@template/shared/settings';
import { mapValues } from 'lodash-es';
import { toJsonSchema } from '#/lib/jsonSchema/toJsonSchema';

const nodeWithJsonSchemas = (
  node: SettingNode | string | undefined,
): SettingNode<SettingJsonSchema> | string | undefined => {
  if (!node || typeof node !== 'object') return node;
  if (isSettingLeaf(node)) return { ...node, schema: toJsonSchema(node.schema, 'input') };
  return settingTreeWithJsonSchemas(node);
};

export const settingTreeWithJsonSchemas = (
  branch: SettingBranch,
): SettingBranch<SettingJsonSchema> =>
  mapValues(branch, nodeWithJsonSchemas) as SettingBranch<SettingJsonSchema>;
