/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */

export { collectRules } from './collectRules';
export { findJsonEnd } from './findJsonEnd';
export {
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
export { parseEachBlock } from './parseEachBlock';
export { parseIfBlock } from './parseIfBlock';
export type { Branch, EachBlock, IfBlock } from './types';
