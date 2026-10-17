/**
 * @atlas
 * @kind validator
 * @partOf primitive:jobs
 * @uses none
 */

// BullMQ quarantines a custom id of '0' or a '0:' prefix, and rejects any id containing ':'
// unless it has exactly three segments (reserved for legacy repeatables).
export const validateJobId = (jobId: string | undefined): void => {
  if (jobId === '0' || jobId?.startsWith('0:')) {
    throw new Error(`Invalid jobId "${jobId}": cannot be '0' or start with '0:'`);
  }
  if (jobId?.includes(':')) {
    throw new Error(
      `Invalid jobId "${jobId}": BullMQ custom jobIds cannot contain ':'; three-segment legacy repeatable IDs are reserved`,
    );
  }
};

export const isValidJobId = (jobId: string): boolean => {
  try {
    validateJobId(jobId);
    return true;
  } catch {
    return false;
  }
};
