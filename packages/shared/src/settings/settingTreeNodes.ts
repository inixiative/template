/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import type {
  SettingBranch,
  SettingLeaf,
  SettingNode,
  SettingSchema,
} from '@template/shared/settings/types';

export type SettingTreeEntry<TSchema = SettingSchema> =
  | { readonly kind: 'meta'; readonly name: string }
  | {
      readonly kind: 'kind';
      readonly field: string;
      readonly value: string;
      readonly node: SettingBranch<TSchema>;
    }
  | { readonly kind: 'leaf'; readonly name: string; readonly node: SettingLeaf<TSchema> }
  | { readonly kind: 'branch'; readonly name: string; readonly node: SettingBranch<TSchema> };

export const isSettingLeaf = <TSchema>(node: SettingNode<TSchema>): node is SettingLeaf<TSchema> =>
  'valueType' in node;

export const settingTreeEntries = <TSchema>(
  branch: SettingBranch<TSchema>,
): SettingTreeEntry<TSchema>[] =>
  Object.entries(branch).flatMap(([name, node]): SettingTreeEntry<TSchema>[] => {
    if (name.startsWith('__')) return [{ kind: 'meta', name }];
    if (!node || typeof node !== 'object') return [];
    const separator = name.indexOf(':');
    if (separator > 0)
      return [
        {
          kind: 'kind',
          field: name.slice(0, separator),
          value: name.slice(separator + 1),
          node: node as SettingBranch<TSchema>,
        },
      ];
    if (isSettingLeaf(node)) return [{ kind: 'leaf', name, node }];
    return [{ kind: 'branch', name, node }];
  });
