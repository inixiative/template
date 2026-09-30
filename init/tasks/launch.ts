import { resolve } from 'node:path';
import { findCommittedMigrations } from '../../scripts/db/release';
import { setLaunched } from '../utils/configHelpers';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { configureCicd } from './cicdSettings';

export type PreflightCheck = {
  label: string;
  passed: boolean;
  detail?: string;
};

/**
 * Sections that must be fully complete before launch.
 * Maps section key → human-readable name.
 */
const REQUIRED_SECTIONS: Array<{ key: keyof ProjectConfig; label: string }> = [
  { key: 'project', label: 'Project Configuration' },
  { key: 'infisical', label: 'Infisical Setup' },
  { key: 'planetscale', label: 'PlanetScale Setup' },
  { key: 'railway', label: 'Railway Setup' },
  { key: 'vercel', label: 'Vercel Setup' },
];

/**
 * Check if a config section's progress is fully complete.
 */
const isSectionComplete = (config: ProjectConfig, key: keyof ProjectConfig): boolean => {
  const section = config[key];
  if (typeof section !== 'object' || section === null) return false;

  const progress = (section as Record<string, unknown>).progress;
  if (typeof progress !== 'object' || progress === null) return false;

  return Object.values(progress as Record<string, boolean>).every((v) => v === true);
};

/**
 * Check if a config section has any errors.
 */
const sectionHasError = (config: ProjectConfig, key: keyof ProjectConfig): string | null => {
  const section = config[key];
  if (typeof section !== 'object' || section === null) return null;

  const error = (section as Record<string, unknown>).error;
  return typeof error === 'string' && error.length > 0 ? error : null;
};

/**
 * Run all preflight checks against the current config.
 * Returns check results and whether all passed.
 */
export const runPreflightChecks = (config: ProjectConfig): { checks: PreflightCheck[]; allPassed: boolean } => {
  const checks: PreflightCheck[] = [];

  // Check each required section
  for (const { key, label } of REQUIRED_SECTIONS) {
    const complete = isSectionComplete(config, key);
    const error = sectionHasError(config, key);

    checks.push({
      label,
      passed: complete && !error,
      detail: error ? `Error: ${error}` : complete ? undefined : 'Incomplete',
    });
  }

  // Check project name is set
  checks.push({
    label: 'Project name configured',
    passed: config.project.name.length > 0,
    detail: config.project.name.length > 0 ? config.project.name : 'Not set',
  });

  const migrations = findCommittedMigrations(resolve(import.meta.dir, '../..'));
  checks.push({
    label: 'Migration baseline committed',
    passed: migrations.length > 0,
    detail: migrations.length > 0 ? undefined : 'No migration SQL under packages/db/prisma — create a baseline first',
  });

  // Check not already launched
  checks.push({
    label: 'Not already launched',
    passed: !config.launched,
    detail: config.launched ? 'Already launched — re-launch not supported' : undefined,
  });

  const allPassed = checks.every((c) => c.passed);
  return { checks, allPassed };
};

/**
 * Execute the launch: releases switch to migrations, then the launched flag flips.
 */
export const executeLaunch = async (): Promise<void> => {
  await configureCicd(['--database=migrations'], resolve(import.meta.dir, '../..'));
  await setLaunched(true);
};
