import type { ModelName } from '@template/db';

// Archive target options for stale-data cold storage. Stub — none implemented
// yet. Configuring `archive` in a cleanStaleData cron payload causes the job
// to fail with a clear error rather than silently deleting without archive.

export type ArchiveTarget = 's3' | 'datalake' | 'cold';

export type ArchiveConfig = {
  target: ArchiveTarget;
  // Target-specific options will land here when each backend is implemented.
};

export const archiveStaleRecords = async (
  model: ModelName,
  where: Record<string, unknown>,
  config: ArchiveConfig,
): Promise<void> => {
  // Reference args so TS doesn't complain about unused params in the stub.
  void model;
  void where;
  throw new Error(
    `Archive not yet implemented — cannot delete ${model} with archive target "${config.target}". ` +
      `Remove the archive field from the cron payload to enable hard-delete, or implement the ${config.target} target.`,
  );
};
