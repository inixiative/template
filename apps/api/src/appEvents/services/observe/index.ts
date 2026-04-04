import { makeBroadcastRegistry } from '@template/shared/adapter';
import type { ObserveAdapter } from '#/appEvents/types';
import { createDbObserveAdapter } from '#/appEvents/services/observe/dbAdapter';

export const observeRegistry = makeBroadcastRegistry<ObserveAdapter>();

observeRegistry.register('db', createDbObserveAdapter());
