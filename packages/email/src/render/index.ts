export {
  type ComposeComponentResult,
  type ComposeTemplateResult,
  composeComponent,
  composeTemplate,
  parentOwner,
} from './compose';
export { type EmailErrorType, EmailRenderError } from './errors';
export { evaluateConditions, type RuleErrorSink } from './evaluateConditions';
export { expand } from './expand';
export { type MappedComponent, type MapResult, mapRefs, type RefMap } from './extractRefs';
export { interpolate, Lens, type Variables } from './interpolate';
export { lookupCascade } from './lookupCascade';
export { lookupComponent, lookupTemplate } from './lookupTemplate';
export { type SaveTemplateInput, type SaveTemplateResult, saveEmailTemplate } from './save';
export { type EmailModel, EmailModels, type EmailModelType, type OwnerScope } from './types';
export {
  assertValidConditions,
  type ConditionIssue,
  ConditionValidationError,
  validateConditions,
} from './validateConditions';
export { assertValidMatrix, type MatrixIssue, MatrixValidationError, validateMatrix } from './validateMatrix';
