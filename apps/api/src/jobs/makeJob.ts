import type { JobHandler } from '#/jobs/types';

export const makeJob = <TPayload = void>(handler: JobHandler<TPayload>): JobHandler<TPayload> => handler;
