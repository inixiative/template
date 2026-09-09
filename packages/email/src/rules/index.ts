export { collectConditionFieldPaths, collectHydrationPaths } from './collectHydrationPaths';
export { collectJsonOpacityWarnings } from './collectJsonOpacityWarnings';
export {
  checkExpectations,
  collectUnprovidedPathWarnings,
  deriveComponentExpectations,
  type ExpectationCheck,
} from './componentExpectations';
export {
  DEFAULT_RECIPIENT_LENS,
  EMAIL_DATA_MODEL,
  EMAIL_RULE_MAP_NAME,
  EMAIL_RULE_ROOT_MODEL,
  type EmailContextRelation,
  type EmailDataLens,
  type EmailDataProjection,
  type EmailProjectionInput,
  type EmailSlotLenses,
  emailLens,
  emailProjection,
  emailSurface,
  parseSlotLenses,
} from './emailProjection';
export { type EmailRuleDecoration, type EmailRuleFacet, emailRuleDecoration } from './emailRuleDecoration';
export {
  isRailProvidedSystemField,
  RAIL_PROVIDED_SYSTEM_FIELDS,
  type RailProvidedSystemField,
} from './railProvidedSystemFields';
export { type BindingChain, resolveBindingPath } from './resolveBindingPath';
export { type ConditionTreeChild, walkConditionTree } from './walkConditionTree';
export { type LensPathWalk, walkLensPath } from './walkLensPath';
