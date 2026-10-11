/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { FlowBound } from '#/modules/flow/definitions/types';

export const boundNames = (bound: FlowBound = {}): string[] =>
  Object.values(bound).map(({ bind }) => bind);

export const resolveBinds = (
  bound: FlowBound = {},
  bindings: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(Object.entries(bound).map(([key, { bind }]) => [key, bindings[bind] ?? '']));
