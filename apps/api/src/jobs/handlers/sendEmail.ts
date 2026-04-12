import { sendEmail as emailPackageSendEmail, type SendEmailInput } from '@template/email/send';
import '#/lib/email';
import { makeJob } from '#/jobs/makeJob';

export type SendEmailPayload = SendEmailInput;

export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  await emailPackageSendEmail(ctx.db, payload, ctx.log);
});
