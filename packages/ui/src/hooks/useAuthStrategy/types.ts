/**
 * @atlas
 * @kind type, hook
 * @partOf primitive:ui
 * @uses none
 */
import type { AuthStrategy } from '@template/ui/store/types/auth';

export type PendingAuthCallback = () => void;

export type AuthStrategyContextType = {
  strategy: AuthStrategy;
  isAuthenticated: boolean;
  runAfterAuthentication: (onSuccess?: PendingAuthCallback) => void;
  setEmbedToken: (token: string) => Promise<void> | void;
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

export type EmbedMessage =
  | EmbedAuthRequiredMessage
  | EmbedAuthTokenMessage
  | EmbedAuthCompleteMessage;
