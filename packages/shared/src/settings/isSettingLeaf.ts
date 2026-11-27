/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import type { SettingLeaf, SettingNode } from '@template/shared/settings/types';

export const isSettingLeaf = (node: SettingNode | undefined): node is SettingLeaf =>
  !!node && 'valueType' in node;
