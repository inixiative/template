/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type PolymorphicAxis, polymorphicAxis } from '@template/db/registries/falsePolymorphism';
import { polymorphicKeyColumns } from '@template/db/registries/polymorphicIs';
import { isModelName, type ModelName } from '@template/db/utils/modelNames';

// why: one statement of "this row's change is that row's" for the cache hook, audit tenancy and the history read (DATABASE.md#parent-edges).
/** The parent is the row a false-polymorphic axis points at, or the row one foreign key names. */
export type ParentEdge = { axis: string } | { parent: ModelName; foreignKey: string };

export const ParentEdgeRegistry = {
  Entitlement: { axis: 'targetModel' },
} as const satisfies Partial<Record<ModelName, ParentEdge>>;

const parentEdges: Partial<Record<ModelName, ParentEdge>> = ParentEdgeRegistry;

export type ParentRow = { model: ModelName; id: string };

export const parentEdgeOf = (child: ModelName): ParentEdge | null => parentEdges[child] ?? null;

const axisIdColumn = (child: ModelName, axis: PolymorphicAxis, value: string): string | null => {
  if (axis.materialized) return axis.materialized;
  const columns = polymorphicKeyColumns(child, axis.field, value);
  if (columns.length > 1)
    throw new Error(
      `${child}.${axis.field}=${value} keys on ${columns.join('+')}; materialize its id`,
    );
  return columns[0] ?? null;
};

/** The row a child's edge points at: model and id, or null when the edge is unset. */
export const parentAlong = (
  child: ModelName,
  edge: ParentEdge,
  row: Record<string, unknown>,
): ParentRow | null => {
  if ('parent' in edge) {
    const id = row[edge.foreignKey];
    return typeof id === 'string' ? { model: edge.parent, id } : null;
  }
  const value = row[edge.axis];
  if (typeof value !== 'string' || !isModelName(value)) return null;
  const column = axisIdColumn(child, polymorphicAxis(child, edge.axis), value);
  const id = column ? row[column] : null;
  return typeof id === 'string' ? { model: value, id } : null;
};

export const parentOf = (child: ModelName, row: Record<string, unknown>): ParentRow | null => {
  const edge = parentEdgeOf(child);
  return edge ? parentAlong(child, edge, row) : null;
};

/** The where on a child's table for "its parent is this row", or null when the edge never reaches that model. */
export const childWhereAlong = (
  child: ModelName,
  edge: ParentEdge,
  parent: ParentRow,
): Record<string, string> | null => {
  if ('parent' in edge)
    return edge.parent === parent.model ? { [edge.foreignKey]: parent.id } : null;
  const axis = polymorphicAxis(child, edge.axis);
  if (!(parent.model in axis.fkMap)) return null;
  const column = axisIdColumn(child, axis, parent.model);
  return column ? { [edge.axis]: parent.model, [column]: parent.id } : null;
};

/** Every registered child that can hang off `parent`, with the where that finds its rows. */
export const childrenOf = (
  parent: ParentRow,
): { child: ModelName; where: Record<string, string> }[] =>
  (Object.entries(parentEdges) as [ModelName, ParentEdge][]).flatMap(([child, edge]) => {
    const where = childWhereAlong(child, edge, parent);
    return where ? [{ child, where }] : [];
  });
