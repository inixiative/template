import { getProjectConfig, writeProjectConfig } from './getProjectConfig';

/**
 * Update a single field in a config section
 * @example updateConfigField('planetscale', 'organization', 'my-org')
 */
export const updateConfigField = async (section: string, key: string, value: string): Promise<void> => {
  const config = await getProjectConfig();
  (config as unknown as Record<string, Record<string, unknown>>)[section][key] = value;
  await writeProjectConfig(config);
};

/**
 * Set the launched flag at the root of project config
 */
export const setLaunched = async (value: boolean): Promise<void> => {
  const config = await getProjectConfig();
  (config as Record<string, unknown>).launched = value;
  await writeProjectConfig(config);
};
