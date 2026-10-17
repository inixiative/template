/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */

import type { Scope } from '@template/email/render/settle/types';
import { get } from 'lodash-es';

export const resolvePath = (path: string, scope: Scope): unknown => {
  const dot = path.indexOf('.');
  const root = dot === -1 ? path : path.slice(0, dot);
  if (!Object.hasOwn(scope, root)) return undefined;
  const base = scope[root];
  return dot === -1 ? base : get(base, path.slice(dot + 1));
};
