/**
 * @atlas
 * @kind hook
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:errors
 */
import { DbAction, HookTiming, registerDbHook } from '@template/db';
import type { Setting } from '@template/db/generated/client/client';
import {
  settingAppliesToIntegrationProvider,
  settingDefinitionForKey,
} from '@template/shared/settings';
import { castArray } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { settingIntegrationProvider } from '#/modules/setting/services/settingIntegrationProvider';

type SettingRow = Partial<Setting>;
type SettingWrite = { data?: SettingRow | SettingRow[]; create?: SettingRow };

const assertSettingFitsProvider = async (row: SettingRow): Promise<void> => {
  const definition = row.key ? settingDefinitionForKey(row.key) : undefined;
  if (!definition?.integrationProviders) return;
  const provider = await settingIntegrationProvider(row);
  if (settingAppliesToIntegrationProvider(definition, provider)) return;
  throw makeError({
    status: 422,
    message: `Setting '${row.key}' does not apply to ${provider ? `a ${provider}` : 'this'} integration`,
  });
};

export const registerSettingIntegrationProviderHook = () => {
  registerDbHook(
    'settingIntegrationProvider:create',
    'Setting',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.upsert],
    async ({ args }) => {
      const write = args as SettingWrite;
      const rows = write.create ? [write.create] : write.data ? castArray(write.data) : [];
      for (const row of rows) await assertSettingFitsProvider(row);
    },
  );
};
