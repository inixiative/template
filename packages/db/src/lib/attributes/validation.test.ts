import { describe, expect, it } from 'bun:test';
import {
  ATTRIBUTE_MODELS,
  attributeFieldsByModel,
  attributeModelViolations,
  isAttributeModel,
  validateAttributeModels,
} from '@template/db/lib/attributes';
import type { AttributeModelConfig } from '@template/db/lib/attributes/types';

describe('validateAttributeModels (DMMF 5-column contract + required indexes)', () => {
  it('validates all registered ATTRIBUTE_MODELS against prismaMap and Prisma schema indexes', () => {
    expect(attributeModelViolations()).toEqual([]);
    expect(() => validateAttributeModels()).not.toThrow();
  });

  it('derives PascalCase model fields map and checks membership via isAttributeModel()', () => {
    expect(isAttributeModel('setting')).toBe(true);
    expect(isAttributeModel('Setting')).toBe(true);
    expect(isAttributeModel('User')).toBe(false);
    expect(attributeFieldsByModel()).toEqual({
      Setting: ['key', 'valueBoolean', 'valueText', 'valueNumber', 'valueDate', 'valueJson'],
    });
  });

  it('flags missing or commented-out GIN indexes on valueJson and accepts Postgres opclass syntax', () => {
    const missingGin = attributeModelViolations({
      schemaBodyByModel: {
        Setting: `
          valueJson Json?
          @@index([valueJson])
        `,
      },
    });
    expect(missingGin).toEqual([
      'Setting.valueJson: missing Postgres GIN index (add @@index([valueJson], type: Gin))',
    ]);
    expect(() =>
      validateAttributeModels({
        schemaBodyByModel: { Setting: `@@index([valueJson])` },
      }),
    ).toThrow(/missing Postgres GIN index/);

    const lineCommentedGin = attributeModelViolations({
      schemaBodyByModel: {
        Setting: `
          // @@index([valueJson], type: Gin)
          @@index([valueJson])
        `,
      },
    });
    expect(lineCommentedGin).toEqual([
      'Setting.valueJson: missing Postgres GIN index (add @@index([valueJson], type: Gin))',
    ]);

    const blockCommentedGin = attributeModelViolations({
      schemaBodyByModel: {
        Setting: `
          /* @@index([valueJson], type: Gin) */
          @@index([valueJson])
        `,
      },
    });
    expect(blockCommentedGin).toEqual([
      'Setting.valueJson: missing Postgres GIN index (add @@index([valueJson], type: Gin))',
    ]);

    const opclassGin = attributeModelViolations({
      schemaBodyByModel: {
        Setting: `
          @@index([valueJson(ops: JsonbPathOps)], type: Gin)
        `,
      },
    });
    expect(opclassGin).toEqual([]);
  });

  it('rejects scalar columns buried behind unrelated leading index fields', () => {
    const buried = attributeModelViolations({
      indexesByModel: {
        Setting: [
          { fields: ['resourceModel', 'createdAt', 'valueBoolean'] },
          { fields: ['key', 'valueText'] },
          { fields: ['valueNumber'] },
          { fields: ['resourceModel', 'valueDate'] },
          { fields: ['valueJson'] },
        ],
      },
    });
    expect(buried).toEqual([
      'Setting.valueBoolean: missing scalar value index (add @@index([key, valueBoolean]))',
      'Setting.valueDate: missing scalar value index (add @@index([key, valueDate]))',
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

    const violations = attributeModelViolations({ models: broken });
    expect(violations.some((error) => error.includes('locatorField'))).toBe(true);
    expect(violations.some((error) => error.includes('valueTypeField'))).toBe(true);
    expect(violations.some((error) => error.includes('resourceModelField'))).toBe(true);
    expect(violations.some((error) => error.includes('disabledField'))).toBe(true);
    expect(violations.some((error) => error.includes('valueBoolean'))).toBe(true);
    expect(violations.some((error) => error.includes('valueText'))).toBe(true);
    expect(violations.some((error) => error.includes('valueNumber'))).toBe(true);
    expect(violations.some((error) => error.includes('valueDate'))).toBe(true);
    expect(violations.some((error) => error.includes('valueJson'))).toBe(true);
    expect(() => validateAttributeModels({ models: broken })).toThrow(
      /Invalid ATTRIBUTE_MODELS configuration/,
    );
  });
});
