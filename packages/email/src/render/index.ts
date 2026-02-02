export { mapRefs, type MappedComponent, type RefMap, type MapResult } from './extractRefs';
export { interpolate, VariablePrefix, type Variables } from './interpolate';
export { evaluateConditions } from './evaluateConditions';
export { saveEmailTemplate, type SaveTemplateInput, type SaveTemplateResult } from './save';
export { EmailModels, type SaveContext, type EmailModel, type EmailModelType } from './types';
export {
  composeTemplate,
  composeComponent,
  type ComposeContext,
  type ComposeTemplateResult,
  type ComposeComponentResult,
} from './compose';
export { EmailRenderError, type EmailErrorType } from './errors';
export { lookupTemplate, lookupComponent } from './lookupTemplate';
export { expand } from './expand';
