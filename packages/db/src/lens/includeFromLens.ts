/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Condition, type Lens, type LensNarrowing, projectByPath } from '@inixiative/json-rules';
import { rootLens } from '@template/db/lens/rootLens';

export type IncludeTree = { [relation: string]: true | { include: IncludeTree } };

const modelFields = (root: Lens, model: string): Record<string, { kind: string; type: string }> | undefined => {
  for (const map of Object.values(root.maps)) {
    const entry = map.models[model];
    if (entry) return entry.fields as Record<string, { kind: string; type: string }>;
  }
  return undefined;
};

// Leading run of `object` relation segments only — `bridge` resolves in memory
// via the bridge dictionary, never a Prisma include.
const relationRun = (root: Lens, model: string, fieldPath: string): { chain: string[]; model: string } => {
  const chain: string[] = [];
  let current = model;
  for (const segment of fieldPath.split('.')) {
    const field = modelFields(root, current)?.[segment];
    if (field?.kind !== 'object') break;
    chain.push(segment);
    current = field.type;
  }
  return { chain, model: current };
};

const collectRelationPaths = (
  condition: Condition,
  model: string,
  root: Lens,
  prefix: string[],
  out: Set<string>,
): void => {
  if (typeof condition === 'boolean' || condition == null) return;
  const c = condition as Record<string, unknown>;

  if (Array.isArray(c.all))
    return void c.all.forEach((s) => collectRelationPaths(s as Condition, model, root, prefix, out));
  if (Array.isArray(c.any))
    return void c.any.forEach((s) => collectRelationPaths(s as Condition, model, root, prefix, out));
  if (c.if) {
    collectRelationPaths(c.if as Condition, model, root, prefix, out);
    collectRelationPaths(c.then as Condition, model, root, prefix, out);
    if (c.else) collectRelationPaths(c.else as Condition, model, root, prefix, out);
    return;
  }

  if (c.aggregate || c.arrayOperator) {
    if (typeof c.field === 'string') {
      const run = relationRun(root, model, c.field);
      if (run.chain.length) {
        const nested = [...prefix, ...run.chain];
        out.add(nested.join('.'));
        if (c.condition) collectRelationPaths(c.condition as Condition, run.model, root, nested, out);
        return;
      }
    }
    if (c.condition) collectRelationPaths(c.condition as Condition, model, root, prefix, out);
    return;
  }

  for (const key of ['field', 'path']) {
    const value = c[key];
    if (typeof value !== 'string') continue;
    const run = relationRun(root, model, value);
    if (run.chain.length) out.add([...prefix, ...run.chain].join('.'));
  }
};

const collapseEmpty = (tree: IncludeTree): IncludeTree => {
  for (const [name, entry] of Object.entries(tree)) {
    if (entry === true) continue;
    const inner = collapseEmpty(entry.include);
    tree[name] = Object.keys(inner).length ? { include: inner } : true;
  }
  return tree;
};

const treeFromPaths = (paths: Set<string>): IncludeTree => {
  const root: IncludeTree = {};
  for (const path of paths) {
    let node = root;
    for (const segment of path.split('.')) {
      const existing = node[segment];
      const next = existing && existing !== true ? existing.include : {};
      node[segment] = { include: next };
      node = next;
    }
  }
  return collapseEmpty(root);
};

const mergeInto = (target: IncludeTree, source: IncludeTree): IncludeTree => {
  for (const [name, entry] of Object.entries(source)) {
    const existing = target[name];
    if (existing === undefined) {
      target[name] = entry;
      continue;
    }
    if (existing === true && entry === true) continue;
    const merged: IncludeTree = {};
    if (existing !== true) mergeInto(merged, existing.include);
    if (entry !== true) mergeInto(merged, entry.include);
    target[name] = Object.keys(merged).length ? { include: merged } : true;
  }
  return target;
};

export const includeFromLens = (lens: Lens | LensNarrowing): IncludeTree | undefined => {
  const byPath = projectByPath(lens);
  const root = 'parent' in lens ? rootLens(lens) : lens;

  const projection = (path: string): IncludeTree | undefined => {
    const visit = byPath.get(path);
    if (!visit) return undefined;
    const include: IncludeTree = {};
    for (const [name, entry] of Object.entries(visit.fields)) {
      if (entry.kind !== 'object') continue;
      const nested = byPath.has(`${path}.${name}`) ? projection(`${path}.${name}`) : undefined;
      include[name] = nested ? { include: nested } : true;
    }
    return Object.keys(include).length > 0 ? include : undefined;
  };

  const [rootKey] = byPath.keys();
  if (!rootKey) return undefined;

  const wherePaths = new Set<string>();
  for (const visit of byPath.values()) {
    for (const clause of visit.whereClauses) collectRelationPaths(clause, visit.modelName, root, [], wherePaths);
  }

  const merged = mergeInto(projection(rootKey) ?? {}, treeFromPaths(wherePaths));
  return Object.keys(merged).length > 0 ? merged : undefined;
};
