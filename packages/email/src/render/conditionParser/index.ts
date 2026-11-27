/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */

export { collectRules } from './collectRules';
export { type DatetimeToken, datetimeTokenAt } from './datetimeTokenAt';
export {
  datetimeExpressionPaths,
  datetimeTokenLabel,
  datetimeTokenPaths,
  datetimeTokenProblems,
} from './datetimeTokenProblems';
export { findJsonEnd } from './findJsonEnd';
export {
  DATETIME,
  EACH,
  ELSE,
  ELSE_IF,
  END,
  END_EACH,
  IF,
  isValidBindingIdentifier,
  RESERVED_BINDING_NAMES,
  RESERVED_SCOPE_ROOTS,
  SCOPE_ROOTS,
  type ScopeRoot,
  TOKEN_PATTERN,
} from './grammar';
export { isStructurallyBalanced } from './isStructurallyBalanced';
export { isUsableLoopBindingName } from './isUsableLoopBindingName';
export { nextTemplateBlockAt } from './nextTemplateBlockAt';
export { parseEachBlock } from './parseEachBlock';
export { parseIfBlock } from './parseIfBlock';
export type { Branch, EachBlock, IfBlock } from './types';
export {
  type TemplateBlockPosition,
  type TemplateBlockScope,
  type TemplateBlockVisitor,
  type TemplateLoop,
  visitTemplateBlocks,
} from './visitTemplateBlocks';
export { visitTextSegments } from './visitTextSegments';
