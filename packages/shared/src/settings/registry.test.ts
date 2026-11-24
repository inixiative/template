import { describe, expect, it } from 'bun:test';
import { encodeAttributeValue, validateAttributeTypedColumns } from '@template/shared/attributes';
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
        SETTING_DEFINITIONS['general.displayLocale'].permission,
        'OrganizationUser',
      ),
    ).toBe('operate');
    expect(
      settingPermissionForModel(
        SETTING_DEFINITIONS['general.displayLocale'].permission,
        'Organization',
      ),
    ).toBe('manage');
    expect(
      settingPermissionForModel(
        SETTING_DEFINITIONS['general.displayLocale'].readPermission,
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
      expect(() =>
        validateAttributeTypedColumns(
          definition.valueType,
          encoded,
          definition.schema as z.ZodType,
        ),
      ).not.toThrow();
    }
  });

  it('ships the minimal clean starter catalog (general category with defaultTimezone and displayLocale)', () => {
    expect(Object.keys(SETTING_CATEGORIES)).toEqual(['general']);
    expect(SETTING_KEYS).toEqual(['general.defaultTimezone', 'general.displayLocale']);
    expect(SETTING_RESOURCE_MODELS).toEqual([
      'User',
      'Organization',
      'Space',
      'OrganizationUser',
      'SpaceUser',
      'Project',
      'Integration',
      'ProjectIntegration',
    ]);
  });

  it('looks up definitions by key and filters by resourceModel in deterministic order', () => {
    expect(settingDefinitionForKey('general.defaultTimezone')?.valueType).toBe('text');
    expect(settingDefinitionForKey('general.displayLocale')?.valueType).toBe('text');
    expect(settingDefinitionForKey('does.not.exist')).toBeUndefined();
    expect(() => settingDefinitionForKeyOrThrow('does.not.exist')).toThrow('Unknown setting key');

    expect(settingDefinitionsForResourceModel('User').map((d) => d.key)).toEqual([
      'general.defaultTimezone',
      'general.displayLocale',
    ]);
    expect(settingDefinitionsForResourceModel('OrganizationUser').map((d) => d.key)).toEqual([
      'general.displayLocale',
    ]);
    expect(settingDefinitionsForResourceModel('Project').map((d) => d.key)).toEqual([
      'general.defaultTimezone',
    ]);
    // Starter template has zero Integration/ProjectIntegration definitions until downstream apps add them
    expect(settingDefinitionsForResourceModel('Integration')).toEqual([]);
    expect(settingDefinitionsForResourceModel('ProjectIntegration')).toEqual([]);
  });
});
