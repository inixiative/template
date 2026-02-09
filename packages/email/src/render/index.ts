export {
  type ComposeComponentResult,
  type ComposeContext,
  type ComposeTemplateResult,
  composeComponent,
  composeTemplate,
} from './compose';
export { type EmailErrorType, EmailRenderError } from './errors';
export { evaluateConditions } from './evaluateConditions';
export { expand } from './expand';
export { type MappedComponent, type MapResult, mapRefs, type RefMap } from './extractRefs';
export { interpolate, VariablePrefix, type Variables } from './interpolate';
export { lookupComponent, lookupTemplate } from './lookupTemplate';
export { type SaveTemplateInput, type SaveTemplateResult, saveEmailTemplate } from './save';
export { type EmailModel, EmailModels, type EmailModelType, type SaveContext } from './types';
