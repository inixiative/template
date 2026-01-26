import type { JobHandler } from '#/jobs/types';

export const makeJob = <TPayload = unknown>(handler: JobHandler<TPayload>): JobHandler<TPayload> => handler;
