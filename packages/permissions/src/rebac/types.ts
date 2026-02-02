import type { AccessorName } from '@template/db';
import type { Condition } from '@inixiative/json-rules';

export type RelationCheck = {
  rel: string; // Field name on record (e.g., 'organization')
  action: string;
};
export type RuleCheck = { rule: Condition };
export type SelfCheck = { self: string }; // FK field to match against current user (e.g., 'userId')

export type ActionRule =
  | string                        // inherit action from same model
  | RelationCheck
  | RuleCheck
  | SelfCheck
  | { any: ActionRule[] }
  | { all: ActionRule[] }
  | null;

export type ModelPermission = {
  actions: Record<string, ActionRule>;
};

export type RebacSchema = Partial<Record<AccessorName, ModelPermission>>;
