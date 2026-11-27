/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { polymorphicAxis } from '@template/db/registries/falsePolymorphism';
import {
  axisTargetIdColumn,
  rowPolymorphicAxisPointsAt,
} from '@template/db/registries/polymorphicAxisPointsAt';
import { isModelName, type ModelName } from '@template/db/utils/modelNames';
import type { ModelRow } from '@template/shared/utils/modelRow';

// why: one statement of "this row's change is that row's" for the cache hook, audit tenancy and the history read (DATABASE.md#parent-edges).
/** The parent is the row a false-polymorphic axis points at, or the row one foreign key names. */
export type ParentEdge = { axis: string } | { parent: ModelName; foreignKey: string };

export const ParentEdgeRegistry = {
  ArtifactEffectivePermission: { parent: 'Artifact', foreignKey: 'artifactId' },
  ArtifactPermission: { parent: 'Artifact', foreignKey: 'artifactId' },
  ArtifactPlacement: { parent: 'Artifact', foreignKey: 'containerArtifactId' },
  Entitlement: { axis: 'targetModel' },
  ProjectIntegration: { parent: 'Project', foreignKey: 'projectId' },
  Setting: { axis: 'resourceModel' },
  TwoFactor: { parent: 'User', foreignKey: 'userId' },
  Passkey: { parent: 'User', foreignKey: 'userId' },
} as const satisfies Partial<Record<ModelName, ParentEdge>>;

const parentEdges: Partial<Record<ModelName, ParentEdge>> = ParentEdgeRegistry;

export type ParentRow = ModelRow<ModelName>;

export const parentEdgeOf = (child: ModelName): ParentEdge | null => parentEdges[child] ?? null;

/** The row a child's edge points at: model and id, or null when the edge is unset. */
export const parentRowAlongEdge = (
  child: ModelName,
  edge: ParentEdge,
  row: Record<string, unknown>,
): ParentRow | null => {
  if ('parent' in edge) {
    const id = row[edge.foreignKey];
    return typeof id === 'string' ? { model: edge.parent, id } : null;
  }
  const target = rowPolymorphicAxisPointsAt(row, child, edge.axis);
  return target && isModelName(target.model) ? { model: target.model, id: target.id } : null;
};

export const parentOf = (child: ModelName, row: Record<string, unknown>): ParentRow | null => {
  const edge = parentEdgeOf(child);
  return edge ? parentRowAlongEdge(child, edge, row) : null;
};

/** The where on a child's table for "its parent is this row", or null when the edge never reaches that model. */
export const childWhereForParentAlongEdge = (
  child: ModelName,
  edge: ParentEdge,
  parent: ParentRow,
): Record<string, string> | null => {
  if ('parent' in edge)
    return edge.parent === parent.model ? { [edge.foreignKey]: parent.id } : null;
  const axis = polymorphicAxis(child, edge.axis);
  if (!(parent.model in axis.fkMap)) return null;
  const column = axisTargetIdColumn(child, axis, parent.model);
  return column ? { [edge.axis]: parent.model, [column]: parent.id } : null;
};

/** Every registered child that can hang off `parent`, with the where that finds its rows. */
export const childrenOf = (
  parent: ParentRow,
): { child: ModelName; where: Record<string, string> }[] =>
  (Object.entries(parentEdges) as [ModelName, ParentEdge][]).flatMap(([child, edge]) => {
    const where = childWhereForParentAlongEdge(child, edge, parent);
    return where ? [{ child, where }] : [];
  });
