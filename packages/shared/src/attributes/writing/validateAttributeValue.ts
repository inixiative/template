/**
 * @atlas
 * @kind validator
 * @partOf primitive:shared
 * @uses primitive:rules
 */
import { check } from '@inixiative/json-rules';
import { deduplicateMultiSelect } from '@template/shared/attributes/parsing/deduplicateMultiSelect';
import { isStringArray } from '@template/shared/attributes/parsing/isStringArray';
import { parseAttributeValue } from '@template/shared/attributes/parsing/parseAttributeValue';
import { AttributeValidationError } from '@template/shared/attributes/typing/columns';
import type {
  AttributeOption,
  AttributeValueConstraints,
} from '@template/shared/attributes/typing/definition';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';
import { castArray } from 'lodash-es';

const notAnOption = (constraints: AttributeValueConstraints, value: unknown): unknown[] => {
  if (!constraints.options) return [];
  const allowed = new Set(constraints.options.map((option) => option.value));
  return castArray(value).filter((entry) => !allowed.has(entry as AttributeOption['value']));
};

/** The value's type, AND in `options` when there are options, AND `conditions` when there are conditions. */
export const validateAttributeValue = (
  valueType: AttributeValueType,
  raw: unknown,
  constraints: AttributeValueConstraints = {},
  options?: { context?: string; pathPrefix?: string[] },
): unknown => {
  const path = options?.pathPrefix ?? [];
  const prefix = options?.context ? `${options.context}: ` : '';
  const parsed = parseAttributeValue(
    valueType,
    raw,
    options?.context,
    path.length ? path : undefined,
  );
  const value =
    valueType === 'multiSelect' && isStringArray(parsed) ? deduplicateMultiSelect(parsed) : parsed;

  const strays = notAnOption(constraints, value);
  if (strays.length > 0)
    throw new AttributeValidationError([
      { code: 'not_an_option', message: `${prefix}not an option: ${strays.join(', ')}`, path },
    ]);

  const verdict = constraints.conditions ? check(constraints.conditions, { value }) : true;
  if (verdict !== true)
    throw new AttributeValidationError([
      { code: 'condition_failed', message: `${prefix}${String(verdict)}`, path },
    ]);

  return value;
};
