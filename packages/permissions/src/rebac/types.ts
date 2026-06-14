/**
 * @atlas
 * @kind type
 * @partOf primitive:authz
 * @uses none
 */
import type { RebacSchema as EngineRebacSchema } from '@inixiative/permissions';
import type { AccessorName } from '@template/db';

// The permission algebra (ActionRule + its parts) and the schema shape are imported from
// @inixiative/permissions, not recapitulated. RebacSchema is the engine's generic schema
// instantiated with this repo's model AccessorNames — so authoring one enforces real model names.
export type {
  ActionRule,
  ModelPermission,
  RelationCheck,
  RuleCheck,
  SelfCheck,
} from '@inixiative/permissions';

export type RebacSchema = EngineRebacSchema<AccessorName>;
