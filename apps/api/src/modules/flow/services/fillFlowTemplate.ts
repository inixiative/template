/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
const TEMPLATE_PARAM = /\{\{(\w+)\}\}/g;

export const flowTemplateParams = (template: string): string[] =>
  [...template.matchAll(TEMPLATE_PARAM)].map(([, name]) => name!);

export const fillFlowTemplate = (
  template: string,
  params: Record<string, string>,
  encode: (value: string) => string = encodeURIComponent,
): string => template.replace(TEMPLATE_PARAM, (_match, name: string) => encode(params[name] ?? ''));
