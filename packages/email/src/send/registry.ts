import { makeBroadcastRegistry } from '@template/shared/adapter';
import type { EmailClient } from '@template/email/client';
import type { EmailVerifier } from '@template/email/client/verification';
import { createNoopVerifier } from '@template/email/client/verification';

export const emailRegistry = makeBroadcastRegistry<EmailClient>();

let verifier: EmailVerifier = createNoopVerifier();

export const setEmailVerifier = (next: EmailVerifier): void => {
  verifier = next;
};

export const getEmailVerifier = (): EmailVerifier => verifier;
