export { AuthStrategyProvider } from './provider';
export type {
  AuthStrategy,
  EmbedAuthCompleteMessage,
  EmbedAuthRequiredMessage,
  EmbedAuthTokenMessage,
  EmbedMessage,
} from './types';
export { useAuthStrategy } from './useAuthStrategy';
export { detectAuthStrategy, isEmbedded } from './utils';
