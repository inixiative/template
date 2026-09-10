/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import {
  type EachBlock,
  isValidBindingIdentifier,
  RESERVED_BINDING_NAMES,
} from '@template/email/render/conditionParser';
import { EACH_MAX_DEPTH, EACH_MAX_ELEMENTS } from '@template/email/render/limits';
import { resolvePath } from '@template/email/render/settle/resolvePath';
import { settle } from '@template/email/render/settle/settle';
import { toRuleData } from '@template/email/render/settle/toRuleData';
import type { RuleErrorSink, Scope, SettleOptions } from '@template/email/render/settle/types';
import { resolveBindingPath } from '@template/email/rules/resolveBindingPath';

export const settleEach = (block: EachBlock, scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string => {
  const issue = (detail: string): '' => {
    onError?.({ kind: 'each', path: block.path, detail });
    return '';
  };

  const eachDepth = (options.eachDepth ?? 0) + 1;
  if (eachDepth > EACH_MAX_DEPTH)
    return issue(`{{#each}} blocks nested more than ${EACH_MAX_DEPTH} deep are not supported`);
  const bodyOptions: SettleOptions = { ...options, eachDepth };

  if (block.attributeErrors?.length) {
    for (const message of block.attributeErrors) onError?.({ kind: 'each', path: block.path, detail: message });
    return '';
  }
  if (block.asMissing || !block.as || !isValidBindingIdentifier(block.as)) {
    return issue('missing or invalid as= attribute on {{#each}} block');
  }
  if (RESERVED_BINDING_NAMES.has(block.as) || Object.hasOwn(scope, block.as)) {
    return issue(`as= "${block.as}" collides with a reserved or enclosing binding`);
  }
  const as = block.as;
  const index = block.index;
  if (index !== undefined && !isValidBindingIdentifier(index))
    return issue('invalid index= attribute on {{#each}} block');
  if (index !== undefined && (RESERVED_BINDING_NAMES.has(index) || Object.hasOwn(scope, index) || index === as)) {
    return issue(`index= "${index}" collides with a reserved or enclosing binding`);
  }
  if (block.filterError !== undefined) return issue(`invalid filter JSON - ${block.filterError}`);

  bodyOptions.bindings = new Map(options.bindings);
  bodyOptions.bindings.set(as, resolveBindingPath(block.path, options.bindings ?? new Map()));
  if (index !== undefined) bodyOptions.bindings.set(index, undefined);

  const arrayValue = resolvePath(block.path, scope);
  if (!Array.isArray(arrayValue)) return issue(`{{#each ${block.path}}} did not resolve to an array`);
  if (arrayValue.length > EACH_MAX_ELEMENTS) {
    return issue(
      `{{#each ${block.path}}} resolved to ${arrayValue.length} elements, over the ${EACH_MAX_ELEMENTS}-element limit`,
    );
  }

  const emitted: unknown[] = [];
  for (const element of arrayValue) {
    if (!block.filter) {
      emitted.push(element);
      continue;
    }
    try {
      if (check(block.filter, toRuleData({ ...scope, [as]: element })) === true) emitted.push(element);
    } catch (err) {
      return issue(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  let out = '';
  emitted.forEach((element, position) => {
    const elementScope: Scope = { ...scope, [as]: element };
    if (index) elementScope[index] = position;
    out += settle(block.body, elementScope, bodyOptions, onError);
  });
  return out;
};
