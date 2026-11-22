/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */

/** Single permission action or per-resourceModel permission map with optional `default`. */
export type AttributePermissionSpec<TAction extends string = string> =
  | TAction
  | ({ readonly default?: TAction } & Partial<Record<string, TAction>>);
