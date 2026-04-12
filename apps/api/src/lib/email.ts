import { createConsoleClient, createResendClient } from '@template/email/client';
import { createBouncerVerifier, createNoopVerifier } from '@template/email/client/verification';
import { emailRegistry, setEmailVerifier } from '@template/email/send';

if (process.env.RESEND_API_KEY) {
  emailRegistry.register('resend', createResendClient(process.env.RESEND_API_KEY));
} else {
  emailRegistry.register('console', createConsoleClient());
}

setEmailVerifier(
  process.env.BOUNCER_API_KEY ? createBouncerVerifier(process.env.BOUNCER_API_KEY) : createNoopVerifier(),
);
