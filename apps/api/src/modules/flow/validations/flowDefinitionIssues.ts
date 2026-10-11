/**
 * @atlas
 * @kind validator
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { listBindings, validateRuleInLens } from '@inixiative/json-rules';
import { type IndexedRoute, readsRows } from '#/lib/routeTemplates/routeIndex';
import type { FlowDefinition, FlowStepDefinition } from '#/modules/flow/definitions/types';
import { SYSTEM_BINDINGS } from '#/modules/flow/services/flowBindings';
import { boundNames } from '#/modules/flow/services/resolveBinds';
import { responseLens } from '#/modules/flow/services/responseLens';

type RouteLookup = (operationId: string) => IndexedRoute | undefined;

const routePathParams = (path: string): string[] =>
  [...path.matchAll(/[:{](\w+)\}?/g)].map(([, name]) => name!).sort();

const readLens = (route: IndexedRoute, read: string) => {
  if (readsRows(route)) return route.filterLens;
  return route.responseSchema ? responseLens(route.responseSchema, read) : null;
};

const stepIssues = (
  step: FlowStepDefinition,
  bindingNames: Set<string>,
  lookup: RouteLookup,
): string[] => {
  const issues: string[] = [];
  const { read, path = {}, query, rule } = step.completedWhen;

  if (step.mode === 'anchor' && !step.hash) issues.push('an anchor step needs a hash');

  const binds = [
    ...listBindings(rule, { required: true }),
    ...boundNames(path),
    ...boundNames(query),
    ...boundNames(step.params),
    ...boundNames(step.search),
  ];
  for (const name of new Set(binds))
    if (!bindingNames.has(name))
      issues.push(`binds "${name}", which the flow's bindings schema does not cover`);

  const route = lookup(read);
  if (!route || route.method !== 'get')
    return [...issues, `read "${read}" is not a registered read route`];
  if (route.many && !readsRows(route))
    return [
      ...issues,
      `read "${read}" lists rows but is not a paginated readMany with a filterLens`,
    ];

  const expected = routePathParams(route.path);
  const given = Object.keys(path).sort();
  if (expected.join() !== given.join())
    issues.push(
      `path must bind exactly [${expected.join(', ')}] for "${read}", got [${given.join(', ')}]`,
    );

  const lens = readLens(route, read);
  if (!lens) return [...issues, `read "${read}" declares no response schema to evaluate against`];
  const { ok, errors } = validateRuleInLens(rule, lens);
  if (!ok)
    issues.push(
      `rule reads outside the lens of "${read}": ${errors.map((error) => error.message).join('; ')}`,
    );
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
    const bindingNames = new Set<string>([
      ...Object.keys(definition.bindingsSchema.shape),
      ...SYSTEM_BINDINGS,
    ]);
    for (const step of definition.steps)
      issues.push(
        ...stepIssues(step, bindingNames, lookup).map((issue) => `${step.key}: ${issue}`),
      );
    return issues.map((issue) => `flow "${key}" ${issue}`);
  });

export const assertValidFlowDefinitions = (
  definitions: Record<string, FlowDefinition>,
  lookup: RouteLookup,
): void => {
  const issues = flowDefinitionIssues(definitions, lookup);
  if (issues.length) throw new Error(`Invalid flow definitions:\n  ${issues.join('\n  ')}`);
};
