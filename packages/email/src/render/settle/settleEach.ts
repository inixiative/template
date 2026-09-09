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
import { inlineRenderErrors } from '@template/email/render/settle/inlineRenderErrors';
import { resolvePath } from '@template/email/render/settle/resolvePath';
import { settle } from '@template/email/render/settle/settle';
import { toRuleData } from '@template/email/render/settle/toRuleData';
import type { RuleErrorSink, Scope, SettleOptions } from '@template/email/render/settle/types';

export const settleEach = (block: EachBlock, scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string => {
  const eachDepth = (options.eachDepth ?? 0) + 1;
  if (eachDepth > EACH_MAX_DEPTH) {
    onError?.(`{{#each}} blocks nested more than ${EACH_MAX_DEPTH} deep are not supported`);
    return '';
  }
  const bodyOptions: SettleOptions = { ...options, eachDepth };

  if (block.attributeErrors?.length) {
    for (const message of block.attributeErrors) onError?.(message);
    return '';
  }
  if (block.asMissing || !block.as || !isValidBindingIdentifier(block.as)) {
    onError?.('missing or invalid as= attribute on {{#each}} block');
    return '';
  }
  if (RESERVED_BINDING_NAMES.has(block.as) || Object.hasOwn(scope, block.as)) {
    onError?.(`as= "${block.as}" collides with a reserved or enclosing binding`);
    return '';
  }
  const as = block.as;
  const index = block.index;
  if (index !== undefined && !isValidBindingIdentifier(index)) {
    onError?.('invalid index= attribute on {{#each}} block');
    return '';
  }
  if (index !== undefined && (RESERVED_BINDING_NAMES.has(index) || Object.hasOwn(scope, index) || index === as)) {
    onError?.(`index= "${index}" collides with a reserved or enclosing binding`);
    return '';
  }
  if (block.filterError !== undefined) {
    onError?.(`invalid filter JSON - ${block.filterError}`);
    return inlineRenderErrors()
      ? `<!-- RULE ERROR: ${block.filterError} -->\n${settle(block.body, scope, bodyOptions, onError)}`
      : '';
  }

  const arrayValue = resolvePath(block.path, scope);
  if (!Array.isArray(arrayValue)) {
    onError?.(`{{#each ${block.path}}} did not resolve to an array`);
    return '';
  }
  if (arrayValue.length > EACH_MAX_ELEMENTS) {
    onError?.(
      `{{#each ${block.path}}} resolved to ${arrayValue.length} elements, over the ${EACH_MAX_ELEMENTS}-element limit`,
    );
    return '';
  }

  const emitted: unknown[] = [];
  let filterThrew = false;
  let firstThrowMessage: string | undefined;
  for (const element of arrayValue) {
    if (!block.filter) {
      emitted.push(element);
      continue;
    }
    try {
      if (check(block.filter, toRuleData({ ...scope, [as]: element })) === true) emitted.push(element);
    } catch (err) {
      filterThrew = true;
      firstThrowMessage ??= err instanceof Error ? err.message : 'Unknown error';
    }
  }

  if (filterThrew) {
    onError?.(firstThrowMessage!);
    if (inlineRenderErrors()) {
      return `<!-- RULE ERROR: ${firstThrowMessage} -->\n${settle(block.body, scope, bodyOptions, onError)}`;
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
