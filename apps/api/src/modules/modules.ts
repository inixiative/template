import { AccessorNames } from '@template/db';

export const Modules = {
  ...AccessorNames,
  me: 'me',
  job: 'job',
  cache: 'cache',
  provider: 'provider', // CustomerRefs where actor is customer
  customer: 'customer', // CustomerRefs where actor is provider
  // files: 'files', // TODO: may be an integration
} as const;

export type Module = (typeof Modules)[keyof typeof Modules];
