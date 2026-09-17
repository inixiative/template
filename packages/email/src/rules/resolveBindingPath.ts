/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
export type BindingChain = Map<string, string | undefined>;

export const resolveBindingPath = (path: string, bindings: BindingChain): string | undefined => {
  const dot = path.indexOf('.');
  const root = dot === -1 ? path : path.slice(0, dot);
  if (!bindings.has(root)) return path;
  const resolved = bindings.get(root);
  if (!resolved) return undefined;
  return dot === -1 ? resolved : `${resolved}${path.slice(dot)}`;
};
