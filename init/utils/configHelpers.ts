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
 * Update multiple fields in a config section atomically (single read-write cycle)
 * @example updateConfigFields('vercel', { teamId: 'team_123', teamName: 'My Team' })
 */
export const updateConfigFields = async (section: string, fields: Record<string, string>): Promise<void> => {
  const config = await getProjectConfig();
  const sectionObj = (config as unknown as Record<string, Record<string, unknown>>)[section];
  for (const [key, value] of Object.entries(fields)) {
    sectionObj[key] = value;
  }
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
