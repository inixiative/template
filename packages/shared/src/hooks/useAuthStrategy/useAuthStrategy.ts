import { useContext } from 'react';
import { AuthStrategyContext } from './provider';

export const useAuthStrategy = () => {
  const context = useContext(AuthStrategyContext);
  if (!context) throw new Error('useAuthStrategy must be used within AuthStrategyProvider');
  return context;
};
