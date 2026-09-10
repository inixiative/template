/**
 * @atlas
 * @kind barrel
 * @partOf feature:email
 * @uses none
 */

export { componentTagPattern, SLUG_PATTERN as COMPONENT_SLUG_PATTERN } from '@template/email/render/blockTags';
export {
  EACH,
  type EachBlock,
  ELSE,
  ELSE_IF,
  END,
  END_EACH,
  findJsonEnd,
  IF,
  isValidBindingIdentifier,
  parseEachBlock,
  RESERVED_BINDING_NAMES,
  TOKEN_PATTERN,
} from '@template/email/render/conditionParser';
export {
  type ComponentWrite,
  type DecomposeResult,
  decompose,
  decomposeNodes,
  type ResolveCascade,
  serialize,
} from '@template/email/render/decompose';
export { guardedToken } from '@template/email/render/guardedToken';
export { canNestMjml, MJML_CHILD_TAGS } from '@template/email/render/mjmlNesting';
export type { ComponentNode, Node, SlotNode, TextNode } from '@template/email/render/nodes';
export { parseBlocks } from '@template/email/render/parseBlocks';
export {
  type ComponentRegion,
  collapseComponentBodies,
  collectComponentRegions,
  collectComponentRegionsFromNodes,
  removeSlotOverride,
  slotDefaultContent,
} from '@template/email/render/regions';
export { SYSTEM_TOKENS, type SystemToken, type SystemTokenName } from '@template/email/render/systemTokens';
