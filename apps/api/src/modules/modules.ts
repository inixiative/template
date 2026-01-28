import { AccessorNames } from '@template/db';

export const Modules = {
  ...AccessorNames,
  me: 'me',
  job: 'job',
  cache: 'cache',
  // files: 'files', // TODO: may be an integration
} as const;

export type Module = (typeof Modules)[keyof typeof Modules];
