import { describe, expect, it } from 'bun:test';
import {
  assertAttributeValueMatchesType,
  attributeColumnForValueType,
  decodeAttributeColumnValue,
  deduplicateMultiSelect,
  encodeAttributeValue,
  populatedAttributeColumns,
  validateAttributeTypedColumns,
} from '@template/shared/attributes';
import { z } from 'zod';

describe('attribute protocol', () => {
  it('maps each AttributeValueType to one of the 5 standard typed columns', () => {
    expect(attributeColumnForValueType('boolean')).toBe('valueBoolean');
    expect(attributeColumnForValueType('text')).toBe('valueText');
    expect(attributeColumnForValueType('number')).toBe('valueNumber');
    expect(attributeColumnForValueType('date')).toBe('valueDate');
    expect(attributeColumnForValueType('json')).toBe('valueJson');
    expect(attributeColumnForValueType('multiSelect')).toBe('valueJson');
  });

  it('deduplicates multiSelect arrays while preserving first-occurrence order', () => {
    expect(deduplicateMultiSelect(['b', 'a', 'b', 'c', 'a'])).toEqual(['b', 'a', 'c']);
    expect(deduplicateMultiSelect([])).toEqual([]);
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
    expect(multiCols.valueJson).toEqual(['security', 'inquiries']);
    expect(decodeAttributeColumnValue('multiSelect', multiCols)).toEqual(['security', 'inquiries']);
  });

  it('rejects wrong JS types in encodeAttributeValue', () => {
    expect(() => encodeAttributeValue('boolean', 'true')).toThrow();
    expect(() => encodeAttributeValue('text', 123)).toThrow();
    expect(() => encodeAttributeValue('number', Number.NaN)).toThrow();
    expect(() => encodeAttributeValue('number', Number.POSITIVE_INFINITY)).toThrow();
    expect(() => encodeAttributeValue('date', 'not-a-date')).toThrow();
    expect(() => encodeAttributeValue('date', new Date('invalid'))).toThrow();
    expect(() => encodeAttributeValue('json', null)).toThrow();
    expect(() => encodeAttributeValue('multiSelect', ['ok', 42])).toThrow();
  });

  it('collects every issue when multiple columns are populated or the target column is missing', () => {
    const missingAndWrong = validateAttributeTypedColumns('boolean', {
      valueText: 'oops',
      valueNumber: 5,
      valueDate: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(missingAndWrong.ok).toBe(false);
    if (!missingAndWrong.ok) {
      expect(missingAndWrong.issues.map((i) => i.code)).toEqual([
        'unexpected_attribute_column',
        'unexpected_attribute_column',
        'unexpected_attribute_column',
        'missing_attribute_value',
      ]);
    }
  });

  it('validates against an optional Zod schema and deduplicates multiSelect values', () => {
    const topicSchema = z.array(z.enum(['inquiries', 'security', 'billing']));
    const valid = validateAttributeTypedColumns(
      'multiSelect',
      { valueJson: ['security', 'inquiries', 'security'] },
      topicSchema,
    );
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.value).toEqual(['security', 'inquiries']);
      expect(valid.columns.valueJson).toEqual(['security', 'inquiries']);
    }

    const invalid = validateAttributeTypedColumns(
      'multiSelect',
      { valueJson: ['unknown-topic'] },
      topicSchema,
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issues[0]?.code).toBe('schema_validation_failed');
    }

    expect(() =>
      assertAttributeValueMatchesType('number', { valueNumber: 500 }, z.number().max(100)),
    ).toThrow();
    expect(
      assertAttributeValueMatchesType('number', { valueNumber: 25 }, z.number().max(100)),
    ).toBe(25);
  });
});
