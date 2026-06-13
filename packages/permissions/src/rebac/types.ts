/**
 * @atlas
 * @kind type
 * @partOf primitive:authz
 * @uses none
 */
import type { ModelPermission } from '@inixiative/permissions';
import type { AccessorName } from '@template/db';

// The permission algebra (ActionRule + its parts) is imported from @inixiative/permissions, not
// recapitulated here. RebacSchema is the one app-specific narrowing: keyed by this repo's model
// AccessorNames instead of the engine's generic string key.
export type {
  ActionRule,
  ModelPermission,
  RelationCheck,
  RuleCheck,
  SelfCheck,
} from '@inixiative/permissions';

export type RebacSchema = Partial<Record<AccessorName, ModelPermission>>;
