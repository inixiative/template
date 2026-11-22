/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import type { AttributePermissionSpec } from '@template/shared/attributes/typing';

/** Resolves a single action or per-resourceModel permission map for `resourceModel`. */
export const attributePermissionForModel = <TAction extends string>(
  spec: AttributePermissionSpec<TAction> | undefined,
  resourceModel: string,
  fallback?: TAction,
): TAction | undefined => {
  if (spec === undefined) return fallback;
  if (typeof spec === 'string') return spec;
  return spec[resourceModel] ?? spec.default ?? fallback;
};
