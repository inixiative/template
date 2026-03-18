import { getProjectConfig, writeProjectConfig } from './getProjectConfig';

/**
 * Update a single field in a config section
 * @example updateConfigField('planetscale', 'organization', 'my-org')
 */
export const updateConfigField = async (section: string, key: string, value: string): Promise<void> => {
  const config = await getProjectConfig();
  (config as Record<string, Record<string, unknown>>)[section][key] = value;
  await writeProjectConfig(config);
};

/**
 * Mark a progress step as complete
 * @example setProgressComplete('planetscale', 'selectOrg')
 */
export const setProgressComplete = async (section: string, action: string): Promise<void> => {
  const config = await getProjectConfig();
  (config as Record<string, { progress: Record<string, boolean> }>)[section].progress[action] = true;
  await writeProjectConfig(config);
};

/**
 * Check if a progress step is complete
 */
export const isProgressComplete = async (section: string, action: string): Promise<boolean> => {
  const config = await getProjectConfig();
  return (config as Record<string, { progress: Record<string, boolean> }>)[section].progress[action] === true;
};

/**
 * Clear all progress flags for a section
 */
export const clearAllProgress = async (section: string): Promise<void> => {
  const config = await getProjectConfig();
  const progress = (config as Record<string, { progress: Record<string, boolean> }>)[section].progress;
  for (const key in progress) {
    progress[key] = false;
  }
  await writeProjectConfig(config);
};

/**
 * Set error message for a section
 */
export const setConfigError = async (section: string, message: string): Promise<void> => {
  const config = await getProjectConfig();
  (config as Record<string, { error: string }>)[section].error = message;
  await writeProjectConfig(config);
};

/**
 * Clear error for a section
 */
export const clearConfigError = async (section: string): Promise<void> => {
  await setConfigError(section, '');
};
