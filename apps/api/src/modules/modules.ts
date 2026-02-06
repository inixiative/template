import { AccessorNames } from '@template/db';

export const Modules = {
  ...AccessorNames,
  me: 'me',
  job: 'job',
  cache: 'cache',
  provider: 'provider',
  customer: 'customer',
  batch: 'batch',
} as const;

export type Module = (typeof Modules)[keyof typeof Modules];
