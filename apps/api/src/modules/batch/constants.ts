export {
  type BatchExecutionStrategy,
  batchExecutionStrategies as BatchExecutionStrategies,
} from '#/modules/batch/services/executor';

export const BatchStatus = {
  success: 'success',
  partialSuccess: 'partialSuccess',
  failed: 'failed',
} as const;

export type BatchStatus = keyof typeof BatchStatus;

import { batchExecutionStrategies } from '#/modules/batch/services/executor';
export const batchExecutionStrategyEnum = Object.keys(batchExecutionStrategies) as [
  keyof typeof batchExecutionStrategies,
  ...Array<keyof typeof batchExecutionStrategies>,
];
export const batchStatusEnum = Object.keys(BatchStatus) as [
  keyof typeof BatchStatus,
  ...Array<keyof typeof BatchStatus>,
];
