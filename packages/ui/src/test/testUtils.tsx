import type { AppStore } from '@template/ui/store/types';
import { createTestStore } from '@template/ui/test/testStore';
import type { ReactNode } from 'react';

export const createTestWrapper = (initialState?: Partial<AppStore>) => {
  const _store = createTestStore(initialState);

  return ({ children }: { children: ReactNode }) => {
    // For now, just return children directly
    // When we need Provider context, we can add it here
    return children;
  };
};
