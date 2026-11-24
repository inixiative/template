import { describe, expect, it } from 'bun:test';
import { Provider, Role, SettingResourceModel } from '@template/db/generated/client/enums';
import { ROLES } from '@template/shared/auth/roles';
import { INTEGRATION_SINGLETONS } from '@template/shared/integrations/integrationSingletons';
import { SETTING_DEFINITIONS, SETTING_RESOURCE_MODELS } from '@template/shared/settings';

describe('shared enum mirrors', () => {
  it('ROLES lists exactly the Prisma Role values, in order', () => {
    expect([...ROLES]).toEqual(Object.values(Role));
  });

  it('SETTING_RESOURCE_MODELS lists exactly the Prisma SettingResourceModel values, in order', () => {
    expect([...SETTING_RESOURCE_MODELS]).toEqual(Object.values(SettingResourceModel));
  });

  it('every INTEGRATION_SINGLETONS key and setting integrationProviders entry is a Prisma Provider value', () => {
    const providers = new Set<string>(Object.values(Provider));
    for (const provider of Object.keys(INTEGRATION_SINGLETONS)) {
      expect(providers.has(provider)).toBe(true);
    }
    for (const definition of Object.values(SETTING_DEFINITIONS)) {
      for (const provider of (definition as { integrationProviders?: readonly string[] })
        .integrationProviders ?? []) {
        expect(providers.has(provider)).toBe(true);
      }
    }
  });
});
