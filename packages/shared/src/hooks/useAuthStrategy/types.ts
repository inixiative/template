export type AuthStrategy =
  | { type: 'redirect'; loginUrl: string }
  | { type: 'otp'; onRequestOtp?: (email: string) => Promise<void> }
  | { type: 'embed'; parentOrigin?: string };

export type PendingAuthCallback = () => void;

export type AuthStrategyContextType = {
  strategy: AuthStrategy;
  isAuthenticated: boolean;
  requireAuth: (onSuccess?: PendingAuthCallback) => void;
  setEmbedToken: (token: string) => void;
  showOtpModal: boolean;
  closeOtpModal: () => void;
  completeOtpAuth: (token: string) => void;
};

export type EmbedAuthRequiredMessage = {
  type: 'embed:auth_required';
  action?: string;
};

export type EmbedAuthTokenMessage = {
  type: 'embed:auth_token';
  token: string;
};

export type EmbedAuthCompleteMessage = {
  type: 'embed:auth_complete';
  success: boolean;
};

export type EmbedMessage = EmbedAuthRequiredMessage | EmbedAuthTokenMessage | EmbedAuthCompleteMessage;
