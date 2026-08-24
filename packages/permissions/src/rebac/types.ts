/**
 * @atlas
 * @kind type
 * @partOf primitive:authz
 * @uses none
 */
import type { RebacSchema as EngineRebacSchema } from '@inixiative/permissions';

export type {
  ActionRule,
  RelationCheck,
  ResourcePermission,
  RuleCheck,
  SelfCheck,
} from '@inixiative/permissions';

export type RebacSchema = EngineRebacSchema;
