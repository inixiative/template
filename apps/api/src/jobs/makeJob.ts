/**
 * @atlas
 * @kind constructor
 * @constructs jobHandler
 * @partOf primitive:jobs
 * @uses none
 */
import type { JobHandler } from '#/jobs/types';

export const makeJob = <TPayload = void>(handler: JobHandler<TPayload>): JobHandler<TPayload> => handler;
