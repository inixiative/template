import { AuthStrategyContext } from '@template/shared/hooks/useAuthStrategy/provider';
import { useContext } from 'react';

export const useAuthStrategy = () => {
  const context = useContext(AuthStrategyContext);
  if (!context) throw new Error('useAuthStrategy must be used within AuthStrategyProvider');
  return context;
};
