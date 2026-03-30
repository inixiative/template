import type { EmailVerifier, VerificationResult } from '@template/email/client/verification/types';

export const createNoopVerifier = (): EmailVerifier => {
  return {
    verify: async (email: string): Promise<VerificationResult> => {
      return {
        email,
        status: 'deliverable',
        isDisposable: false,
        didYouMean: null,
      };
    },
  };
};
