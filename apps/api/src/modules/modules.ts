import { ModelAccessors } from '@template/db';

export const Modules = {
  ...ModelAccessors,
  me: 'me',
  job: 'job',
  cache: 'cache',
  // files: 'files', // TODO: may be an integration
} as const;

export type Module = (typeof Modules)[keyof typeof Modules];
