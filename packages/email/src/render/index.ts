export { BLOCK_TAG, componentTagPattern, SLUG_PATTERN } from './blockTags';
export {
  type ComposeComponentResult,
  type ComposeTemplateResult,
  composeComponent,
  composeTemplate,
  parentOwner,
} from './compose';
export {
  type ComponentWrite,
  collectSlugs,
  type DecomposeResult,
  decompose,
  decomposeNodes,
  type ResolveCascade,
  serialize,
} from './decompose';
export { deriveTextFromHtml } from './deriveTextFromHtml';
export { evaluateConditions, type RuleErrorSink } from './evaluateConditions';
export { expand, expandWith, type LookupComponents } from './expand';
export { hydrate, hydrateCascade, type ResolveHydrateBodies } from './hydrate';
export { type InterpolateOptions, interpolate, type Variables } from './interpolate';
export { EACH_MAX_DEPTH, EACH_MAX_ELEMENTS } from './limits';
export { lookupCascade } from './lookupCascade';
export { lookupComponent, lookupTemplate } from './lookupTemplate';
export {
  type ComponentNode,
  collectSlugsFromNodes,
  isOverrideSlot,
  type Node,
  type SlotNode,
  type TextNode,
} from './nodes';
export { parseBlocks } from './parseBlocks';
export { sanitizeSubject } from './sanitizeSubject';
export { type SaveTemplateInput, type SaveTemplateResult, saveEmailTemplate } from './save';
export { SYSTEM_TOKENS, type SystemToken, type SystemTokenName } from './systemTokens';
export { type EmailModel, EmailModels, type EmailModelType, type OwnerScope } from './types';
