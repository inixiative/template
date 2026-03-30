export type VerificationStatus = 'deliverable' | 'undeliverable' | 'risky' | 'unknown';

export type VerificationResult = {
  email: string;
  status: VerificationStatus;
  reason?: string;
  isDisposable?: boolean;
  didYouMean?: string | null;
};

export type EmailVerifier = {
  verify: (email: string) => Promise<VerificationResult>;
};
