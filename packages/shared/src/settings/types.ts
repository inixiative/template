/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
import type { AttributeFieldDefinition, AttributeValueType } from '@template/shared/attributes';
import type {
  SettingPermissionAction,
  SettingResourceModelName,
} from '@template/shared/settings/resourceModels';
import type { z } from 'zod';

export type SettingCategoryDefinition<TKey extends string = string> = {
  readonly key: TKey;
  readonly label: string;
  readonly description: string;
  readonly order: number;
};

export type SettingDefinition<
  TKey extends string = string,
  TCategory extends string = string,
  TValue = unknown,
> = Omit<
  AttributeFieldDefinition<TKey, TValue>,
  'category' | 'order' | 'resourceModels' | 'permission' | 'readPermission'
> & {
  readonly key: TKey;
  readonly category: TCategory;
  readonly resourceModels: readonly SettingResourceModelName[];
  readonly valueType: AttributeValueType;
  readonly schema: z.ZodType<TValue>;
  readonly defaultValue: TValue | null;
  readonly label: string;
  readonly description: string;
  readonly order: number;
  readonly permission: SettingPermissionAction;
  readonly readPermission?: SettingPermissionAction;
};

/** Declares a typed setting category definition without side effects. */
export const defineSettingCategory = <const T extends SettingCategoryDefinition>(category: T): T =>
  category;

/** Declares a typed setting definition without side effects. */
export const defineSetting = <const T extends SettingDefinition>(definition: T): T => definition;
