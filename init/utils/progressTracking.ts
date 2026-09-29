import { getProjectConfig, PROGRESS_KEYS, writeProjectConfig } from './getProjectConfig';

export type ProgressSection = keyof typeof PROGRESS_KEYS;

export type ProgressActions = { [S in ProgressSection]: (typeof PROGRESS_KEYS)[S][number] };

export type ProjectAction = ProgressActions['project'];
export type InfisicalAction = ProgressActions['infisical'];
export type PlanetScaleAction = ProgressActions['planetscale'];
export type RailwayAction = ProgressActions['railway'];
export type RailwayPostgresAction = ProgressActions['railwayPostgres'];
export type RailwayBucketsAction = ProgressActions['railwayBuckets'];
export type CloudflarePagesAction = ProgressActions['cloudflarePages'];
export type ResendAction = ProgressActions['resend'];
export type BouncerAction = ProgressActions['bouncer'];
export type VercelAction = ProgressActions['vercel'];

/**
 * Mark a step as complete
 */
export const markComplete = async <S extends ProgressSection>(
  section: S,
  action: ProgressActions[S],
): Promise<void> => {
  const config = await getProjectConfig();
  (config[section] as { progress: Record<string, boolean> }).progress[action] = true;
  await writeProjectConfig(config);
};

/**
 * Check if a step is complete
 */
export const isComplete = async <S extends ProgressSection>(
  section: S,
  action: ProgressActions[S],
): Promise<boolean> => {
  const config = await getProjectConfig();
  return (config[section] as { progress: Record<string, boolean> }).progress[action] === true;
};

/**
 * Clear all progress for a section (set all flags to false)
 */
export const clearProgress = async (section: ProgressSection): Promise<void> => {
  const config = await getProjectConfig();
  const progress = (config[section] as { progress: Record<string, boolean> }).progress;
  for (const key in progress) {
    progress[key] = false;
  }
  await writeProjectConfig(config);
};

/**
 * Set error message for a section
 */
export const setError = async (section: ProgressSection, message: string): Promise<void> => {
  const config = await getProjectConfig();
  (config[section] as { error: string }).error = message;
  await writeProjectConfig(config);
};

/**
 * Clear error for a section
 */
export const clearError = async (section: ProgressSection): Promise<void> => {
  await setError(section, '');
};
