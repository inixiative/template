import { describe, expect, it } from 'bun:test';
import { FieldKind } from '@inixiative/json-rules';
import {
  ATTRIBUTE_FIELD_KIND_BY_VALUE_TYPE,
  AttributeValidationError,
  attributeColumnForValueType,
  decodeAttributeColumnValue,
  deduplicateMultiSelect,
  encodeAttributeValue,
  isStringArray,
  parseAttributeValue,
  populatedAttributeColumns,
  validateAttributeTypedColumns,
  validateAttributeValue,
} from '@template/shared/attributes';
import { z } from 'zod';

const captureValidationError = (fn: () => unknown): AttributeValidationError => {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(AttributeValidationError);
  return caught as AttributeValidationError;
};

describe('attribute protocol', () => {
  it('maps each AttributeValueType to one of the 5 standard typed columns and json-rules FieldKind', () => {
    expect(attributeColumnForValueType('boolean')).toBe('valueBoolean');
    expect(attributeColumnForValueType('text')).toBe('valueText');
    expect(attributeColumnForValueType('number')).toBe('valueNumber');
    expect(attributeColumnForValueType('date')).toBe('valueDate');
    expect(attributeColumnForValueType('json')).toBe('valueJson');
    expect(attributeColumnForValueType('multiSelect')).toBe('valueJson');

    expect(ATTRIBUTE_FIELD_KIND_BY_VALUE_TYPE).toEqual({
      boolean: FieldKind.Boolean,
      text: FieldKind.String,
      number: FieldKind.Float,
      date: FieldKind.DateTime,
      json: FieldKind.Json,
      multiSelect: FieldKind.Json,
    });

    expect(parseAttributeValue('number', 42)).toBe(42);
    expect(() => parseAttributeValue('number', Number.NaN)).toThrow(AttributeValidationError);
    expect(parseAttributeValue('multiSelect', ['b', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('deduplicates and canonically sorts multiSelect arrays for set-equality stability', () => {
    expect(deduplicateMultiSelect(['b', 'a', 'b', 'c', 'a'])).toEqual(['a', 'b', 'c']);
    expect(deduplicateMultiSelect(['c', 'a'])).toEqual(deduplicateMultiSelect(['a', 'c']));
    expect(deduplicateMultiSelect([])).toEqual([]);
    expect(isStringArray(['a', 'b'])).toBe(true);
    expect(isStringArray(['a', 1])).toBe(false);
  });

  it('encodes and decodes all 6 valueTypes with all 4 sibling columns cleared to null', () => {
    const boolCols = encodeAttributeValue('boolean', true);
    expect(boolCols).toEqual({
      valueBoolean: true,
      valueText: null,
      valueNumber: null,
      valueDate: null,
      valueJson: null,
    });
    expect(decodeAttributeColumnValue('boolean', boolCols)).toBe(true);

    const textCols = encodeAttributeValue('text', 'UTC');
    expect(textCols.valueText).toBe('UTC');
    expect(populatedAttributeColumns(textCols)).toEqual(['valueText']);
    expect(decodeAttributeColumnValue('text', textCols)).toBe('UTC');

    const numCols = encodeAttributeValue('number', 42.5);
    expect(numCols.valueNumber).toBe(42.5);
    expect(populatedAttributeColumns(numCols)).toEqual(['valueNumber']);
    expect(decodeAttributeColumnValue('number', numCols)).toBe(42.5);

    const iso = '2026-12-01T12:00:00.000Z';
    const dateCols = encodeAttributeValue('date', iso);
    expect(dateCols.valueDate).toBeInstanceOf(Date);
    expect(dateCols.valueDate?.toISOString()).toBe(iso);
    expect(populatedAttributeColumns(dateCols)).toEqual(['valueDate']);
    expect((decodeAttributeColumnValue('date', dateCols) as Date).toISOString()).toBe(iso);

    const jsonCols = encodeAttributeValue('json', { enabled: true, startHour: 22 });
    expect(jsonCols.valueJson).toEqual({ enabled: true, startHour: 22 });
    expect(decodeAttributeColumnValue('json', jsonCols)).toEqual({ enabled: true, startHour: 22 });

    const multiCols = encodeAttributeValue('multiSelect', ['security', 'inquiries', 'security']);
    expect(multiCols.valueJson).toEqual(['inquiries', 'security']);
    expect(decodeAttributeColumnValue('multiSelect', multiCols)).toEqual(['inquiries', 'security']);
  });

  it('rejects wrong JS types in encodeAttributeValue', () => {
    expect(() => encodeAttributeValue('boolean', 'true')).toThrow(AttributeValidationError);
    expect(() => encodeAttributeValue('text', 123)).toThrow(AttributeValidationError);
    expect(() => encodeAttributeValue('number', Number.NaN)).toThrow(AttributeValidationError);
    expect(() => encodeAttributeValue('number', Number.POSITIVE_INFINITY)).toThrow(
      AttributeValidationError,
    );
    expect(() => encodeAttributeValue('date', 'not-a-date')).toThrow(AttributeValidationError);
    expect(() => encodeAttributeValue('date', new Date('invalid'))).toThrow(
      AttributeValidationError,
    );
    expect(() => encodeAttributeValue('json', null)).toThrow(AttributeValidationError);
    expect(() => encodeAttributeValue('multiSelect', ['ok', 42])).toThrow(AttributeValidationError);
  });

  it('collects every issue when multiple columns are populated or the target column is missing', () => {
    const err = captureValidationError(() =>
      validateAttributeTypedColumns('boolean', {
        valueText: 'oops',
        valueNumber: 5,
        valueDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    expect(err.issues.map((i) => i.code)).toEqual([
      'unexpected_attribute_column',
      'unexpected_attribute_column',
      'unexpected_attribute_column',
      'missing_attribute_value',
    ]);
  });

  it('validates against an optional Zod schema (including z.iso.datetime) and canonicalizes multiSelect', () => {
    const topicSchema = z.array(z.enum(['inquiries', 'security', 'billing']));
    expect(
      validateAttributeTypedColumns(
        'multiSelect',
        { valueJson: ['security', 'inquiries', 'security'] },
        topicSchema,
      ),
    ).toEqual(['inquiries', 'security']);

    const invalidErr = captureValidationError(() =>
      validateAttributeValue('multiSelect', ['unknown-topic'], topicSchema),
    );
    expect(invalidErr.issues[0]?.code).toBe('schema_validation_failed');

    const isoDate = validateAttributeValue('date', '2026-12-01T12:00:00.000Z', z.iso.datetime());
    expect(isoDate).toBeInstanceOf(Date);
    expect((isoDate as unknown as Date).toISOString()).toBe('2026-12-01T12:00:00.000Z');

    const dateObjWithIsoSchema = validateAttributeValue(
      'date',
      new Date('2026-12-01T12:00:00.000Z'),
      z.iso.datetime(),
    );
    expect(dateObjWithIsoSchema).toBeInstanceOf(Date);

    expect(() => validateAttributeValue('date', 'Dec 1, 2026', z.iso.datetime())).toThrow(
      AttributeValidationError,
    );

    expect(() =>
      validateAttributeTypedColumns('number', { valueNumber: 500 }, z.number().max(100)),
    ).toThrow(AttributeValidationError);
    expect(validateAttributeTypedColumns('number', { valueNumber: 25 }, z.number().max(100))).toBe(
      25,
    );
  });
});
