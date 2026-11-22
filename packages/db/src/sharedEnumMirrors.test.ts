import { describe, expect, it } from 'bun:test';
import { Role, SettingResourceModel } from '@template/db/generated/client/enums';
import { ROLES } from '@template/shared/auth/roles';
import { SETTING_RESOURCE_MODELS } from '@template/shared/settings';

describe('shared enum mirrors', () => {
  it('ROLES lists exactly the Prisma Role values, in order', () => {
    expect([...ROLES]).toEqual(Object.values(Role));
  });

  it('SETTING_RESOURCE_MODELS lists exactly the Prisma SettingResourceModel values, in order', () => {
    expect([...SETTING_RESOURCE_MODELS]).toEqual(Object.values(SettingResourceModel));
  });
});
