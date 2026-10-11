/**
 * @atlas
 * @kind validator
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { listBindings, validateRuleInLens } from '@inixiative/json-rules';
import type { IndexedRoute } from '#/lib/routeTemplates/routeIndex';
import type { FlowDefinition, FlowStepDefinition } from '#/modules/flow/definitions/types';
import { flowTemplateParams } from '#/modules/flow/services/fillFlowTemplate';
import { FLOW_BINDINGS } from '#/modules/flow/services/flowBindings';

type RouteLookup = (operationId: string) => IndexedRoute | undefined;

const routePathParams = (path: string): string[] =>
  [...path.matchAll(/[:{](\w+)\}?/g)].map(([, name]) => name!).sort();

const stepIssues = (
  step: FlowStepDefinition,
  paramNames: Set<string>,
  lookup: RouteLookup,
): string[] => {
  const issues: string[] = [];
  const { read, path = {}, where, count } = step.completedWhen;

  const templates = [step.url, ...Object.values(path)];
  for (const name of templates.flatMap(flowTemplateParams))
    if (!paramNames.has(name)) issues.push(`{{${name}}} is not a param of this flow`);
  if (count && (!Number.isInteger(count.atLeast) || count.atLeast < 1))
    issues.push('count.atLeast must be a positive integer');

  const route = lookup(read);
  if (!route) return [...issues, `read "${read}" is not a registered route`];
  if (route.method !== 'get' || !route.many || !route.paginate || !route.filterLens)
    return [...issues, `read "${read}" is not a paginated readMany route with a filterLens`];

  const expected = routePathParams(route.path);
  const given = Object.keys(path).sort();
  if (expected.join() !== given.join())
    issues.push(
      `path must fill exactly [${expected.join(', ')}] for "${read}", got [${given.join(', ')}]`,
    );

  if (where) {
    const allowed = new Set<string>([...paramNames, ...FLOW_BINDINGS]);
    for (const name of listBindings(where))
      if (!allowed.has(name))
        issues.push(`where binds "${name}", which is not a param of this flow`);
    const { ok, errors } = validateRuleInLens(where, route.filterLens);
    if (!ok)
      issues.push(
        `where reads outside the filterLens of "${read}": ${errors.map((e) => e.message).join('; ')}`,
      );
  }
  return issues;
};

export const flowDefinitionIssues = (
  definitions: Record<string, FlowDefinition>,
  lookup: RouteLookup,
): string[] =>
  Object.entries(definitions).flatMap(([key, definition]) => {
    const issues: string[] = [];
    if (definition.key !== key) issues.push(`holds the definition of "${definition.key}"`);
    if (!definition.steps.length) issues.push('has no steps');
    if (new Set(definition.steps.map((step) => step.key)).size !== definition.steps.length)
      issues.push('repeats a step key');
    const paramNames = new Set(Object.keys(definition.paramsSchema.shape));
    for (const step of definition.steps)
      issues.push(...stepIssues(step, paramNames, lookup).map((issue) => `${step.key}: ${issue}`));
    return issues.map((issue) => `flow "${key}" ${issue}`);
  });

export const assertValidFlowDefinitions = (
  definitions: Record<string, FlowDefinition>,
  lookup: RouteLookup,
): void => {
  const issues = flowDefinitionIssues(definitions, lookup);
  if (issues.length) throw new Error(`Invalid flow definitions:\n  ${issues.join('\n  ')}`);
};
