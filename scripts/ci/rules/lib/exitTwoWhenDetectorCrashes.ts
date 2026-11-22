/**
 * Every detector imports this first. A violation exits 1; a detector that throws or leaves a rejection
 * unhandled exits 2, so a crash is never read as a reported violation (run-ci-rules.sh --test).
 */
export const DETECTOR_CRASHED_EXIT_CODE = 2;

const exitAsCrashed = (error: unknown) => {
  console.error(error);
  process.exit(DETECTOR_CRASHED_EXIT_CODE);
};

process.on('uncaughtException', exitAsCrashed);
process.on('unhandledRejection', exitAsCrashed);
