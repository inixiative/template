import { describe, expect, it } from 'bun:test';
import {
  ATTRIBUTE_MODELS,
  attributeFieldsByModel,
  isAttributeModel,
  validateAttributeModels,
} from '@template/db/lib/attributes';
import type { AttributeModelConfig } from '@template/db/lib/attributes/types';

describe('validateAttributeModels (DMMF 5-column contract + required indexes)', () => {
  it('validates all registered ATTRIBUTE_MODELS against prismaMap and Prisma schema indexes', () => {
    const result = validateAttributeModels();
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('derives PascalCase model fields map and checks membership via isAttributeModel()', () => {
    expect(isAttributeModel('setting')).toBe(true);
    expect(isAttributeModel('Setting')).toBe(true);
    expect(isAttributeModel('User')).toBe(false);
    expect(attributeFieldsByModel()).toEqual({
      Setting: ['key', 'valueBoolean', 'valueText', 'valueNumber', 'valueDate', 'valueJson'],
    });
  });

  it('flags a missing GIN index on valueJson even when columns and scalar indexes exist', () => {
    const result = validateAttributeModels({
      schemaBodyByModel: {
        Setting: `
          valueBoolean Boolean?
          valueText String?
          valueNumber Float?
          valueDate DateTime?
          valueJson Json?
          @@index([valueJson])
        `,
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'Setting.valueJson: missing Postgres GIN index (add @@index([valueJson], type: Gin))',
    ]);
  });

  it('reports every missing typed column, invalid locator/resource/disabled/valueType field, and missing index on a non-attribute model', () => {
    const broken: Record<string, AttributeModelConfig> = {
      user: {
        ...ATTRIBUTE_MODELS.setting,
        model: 'user' as unknown as 'setting',
        locatorField: 'nonExistentLocator',
        valueTypeField: 'nonExistentValueType',
        resourceModelField: 'nonExistentResourceModel',
        disabledField: 'email',
      } as unknown as AttributeModelConfig,
    };

    const result = validateAttributeModels({ models: broken });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('locatorField'))).toBe(true);
    expect(result.errors.some((error) => error.includes('valueTypeField'))).toBe(true);
    expect(result.errors.some((error) => error.includes('resourceModelField'))).toBe(true);
    expect(result.errors.some((error) => error.includes('disabledField'))).toBe(true);
    expect(result.errors.some((error) => error.includes('valueBoolean'))).toBe(true);
    expect(result.errors.some((error) => error.includes('valueText'))).toBe(true);
    expect(result.errors.some((error) => error.includes('valueNumber'))).toBe(true);
    expect(result.errors.some((error) => error.includes('valueDate'))).toBe(true);
    expect(result.errors.some((error) => error.includes('valueJson'))).toBe(true);
  });
});
