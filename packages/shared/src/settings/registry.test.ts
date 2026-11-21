import { describe, expect, it } from 'bun:test';
import { attributeTypedColumnIssues, encodeAttributeValue } from '@template/shared/attributes';
import {
  SETTING_CATEGORIES,
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  SETTING_RESOURCE_MODELS,
  SettingPermissionSpecSchema,
  settingCategoryForKey,
  settingDefinitionForKey,
  settingDefinitionForKeyOrThrow,
  settingDefinitionsForResourceModel,
  settingPermissionForModel,
} from '@template/shared/settings';
import type { z } from 'zod';

describe('SETTING_DEFINITIONS registry invariants', () => {
  it('every definition key matches its map key, points at a registered category, and resolves permissions for every listed resourceModel', () => {
    for (const [key, definition] of Object.entries(SETTING_DEFINITIONS)) {
      expect(definition.key as string).toBe(key);
      expect(settingCategoryForKey(definition.category)).toBeDefined();
      expect(definition.resourceModels.length).toBeGreaterThan(0);
      expect(SettingPermissionSpecSchema.safeParse(definition.permission).success).toBe(true);
      const readPerm = 'readPermission' in definition ? definition.readPermission : undefined;
      if (readPerm !== undefined) {
        expect(SettingPermissionSpecSchema.safeParse(readPerm).success).toBe(true);
      }
      for (const model of definition.resourceModels) {
        expect(settingPermissionForModel(definition.permission, model)).toBeTruthy();
        expect(settingPermissionForModel(readPerm, model, 'read')).toBeTruthy();
      }
    }

    expect(
      settingPermissionForModel(
        SETTING_DEFINITIONS['notifications.topics'].permission,
        'OrganizationUser',
      ),
    ).toBe('operate');
    expect(
      settingPermissionForModel(
        SETTING_DEFINITIONS['notifications.topics'].permission,
        'Organization',
      ),
    ).toBe('manage');
    expect(
      settingPermissionForModel(
        SETTING_DEFINITIONS['notifications.topics'].readPermission,
        'SpaceUser',
        'read',
      ),
    ).toBe('operate');
    expect(() => settingPermissionForModel({ User: 'manage' }, 'Organization')).toThrow(
      /no action or default/,
    );
  });

  it('every non-null defaultValue validates cleanly under its valueType and Zod schema', () => {
    for (const definition of Object.values(SETTING_DEFINITIONS)) {
      if (definition.defaultValue === null) continue;
      const encoded = encodeAttributeValue(definition.valueType, definition.defaultValue);
      const checked = attributeTypedColumnIssues(
        definition.valueType,
        encoded,
        definition.schema as z.ZodType,
      );
      expect(checked.ok).toBe(true);
    }
  });

  it('every category key matches its map key', () => {
    for (const [key, category] of Object.entries(SETTING_CATEGORIES)) {
      expect(category.key as string).toBe(key);
    }
  });

  it('covers all 6 AttributeValueTypes across built-in definitions', () => {
    const valueTypes = new Set(Object.values(SETTING_DEFINITIONS).map((def) => def.valueType));
    expect([...valueTypes].sort()).toEqual([
      'boolean',
      'date',
      'json',
      'multiSelect',
      'number',
      'text',
    ]);
  });

  it('looks up definitions by key and filters by resourceModel in deterministic order', () => {
    expect(SETTING_KEYS.length).toBeGreaterThan(0);
    expect(settingDefinitionForKey('general.defaultTimezone')?.valueType).toBe('text');
    expect(settingDefinitionForKey('notifications.snoozeUntil')?.valueType).toBe('date');
    expect(settingDefinitionForKey('does.not.exist')).toBeUndefined();
    expect(() => settingDefinitionForKeyOrThrow('does.not.exist')).toThrow('Unknown setting key');

    for (const resourceModel of SETTING_RESOURCE_MODELS) {
      const defs = settingDefinitionsForResourceModel(resourceModel);
      expect(defs.length).toBeGreaterThan(0);
      expect(defs.every((def) => def.resourceModels.includes(resourceModel))).toBe(true);
    }

    const memberDefs = settingDefinitionsForResourceModel('OrganizationUser');
    expect(memberDefs.map((def) => def.key)).toContain('member.autoAcceptInquiries');
    expect(memberDefs.map((def) => def.key)).not.toContain('general.defaultTimezone');
  });
});
