/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses none
 * @constructs jobHandler
 */
import type { JobHandler } from '#/jobs/types';

export const makeJob = <TPayload = void>(handler: JobHandler<TPayload>): JobHandler<TPayload> => handler;
