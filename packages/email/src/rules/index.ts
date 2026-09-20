export { absoluteRule } from './absoluteRule';
export { collectConditionFieldPaths, collectHydrationPaths } from './collectHydrationPaths';
export { collectJsonOpacityWarnings } from './collectJsonOpacityWarnings';
export {
  checkExpectations,
  collectUnprovidedPathWarnings,
  deriveComponentExpectations,
  type ExpectationCheck,
} from './componentExpectations';
export {
  applyEmailLens,
  DEFAULT_RECIPIENT_NARROWING,
  declaredFields,
  defaultEmailLens,
  EMAIL_DATA_MODEL,
  EMAIL_MAP_NAME,
  EMAIL_SURFACE_ROOT,
  EMAIL_SYSTEM_MODEL,
  type EmailLens,
  type EmailLensInput,
  type EmailRuleDecoration,
  type EmailRuleFacet,
  type EmailSlotLenses,
  emailLens,
  emailRuleDecoration,
  emailRuleReferences,
  emailRuleViolations,
  emailRuleVocabulary,
  emailRuleVocabularyIssues,
  emailSlotLenses,
  emailSourceQueries,
  emailSurface,
  evaluateScopedRule,
  fieldsLens,
  narrowEmailLens,
  OPAQUE_SLOT,
  parseSlotLenses,
  type SlotLens,
  slotOf,
  splitRoot,
  systemSlot,
  walkEmailLensPath,
} from './emailLens';
export { emptyRowFor } from './emptyRowFor';
export {
  isRailProvidedSystemField,
  RAIL_PROVIDED_SYSTEM_FIELDS,
  type RailProvidedSystemField,
} from './railProvidedSystemFields';
export { type BindingChain, resolveBindingPath } from './resolveBindingPath';
export { contentRuleReferences } from './ruleReferences';
export { type LoopFrame, loopFrames, narrowToElements, scopedRule } from './scopedRule';
export { type EmailLensOwner, scopeEmailLens } from './scopeEmailLens';
export { syncRuleReferences } from './syncRuleReferences';
export { type ConditionTreeChild, walkConditionTree } from './walkConditionTree';
export { type LensPathWalk, lensPathFields, walkLensPath } from './walkLensPath';
