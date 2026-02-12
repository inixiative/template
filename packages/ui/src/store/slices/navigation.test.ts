/**@jsdom*/
import { createTestStore } from '@template/ui/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('navigation slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const { navigation } = store.getState();

      expect(navigation.navigate).toBe(null);
      expect(navigation.navConfig).toBe(null);
      expect(navigation.currentRouteMatch).toBe(null);
    });

    it('should have required methods', () => {
      const { navigation } = store.getState();

      expect(typeof navigation.setNavigate).toBe('function');
      expect(typeof navigation.setNavConfig).toBe('function');
      expect(typeof navigation.setCurrentRouteMatch).toBe('function');
      expect(typeof navigation.navigatePreservingContext).toBe('function');
      expect(typeof navigation.navigatePreservingSpoof).toBe('function');
    });
  });

  describe('setNavigate', () => {
    it('should set the navigate function', () => {
      const mockNavigate = vi.fn();

      store.getState().navigation.setNavigate(mockNavigate as any);

      expect(store.getState().navigation.navigate).toBeDefined();
      expect(typeof store.getState().navigation.navigate).toBe('function');
    });
  });

  describe('setNavConfig', () => {
    it('should set the nav config', () => {
      const mockConfig = { items: [] } as any;

      store.getState().navigation.setNavConfig(mockConfig);

      expect(store.getState().navigation.navConfig).toBe(mockConfig);
    });
  });

  describe('setCurrentRouteMatch', () => {
    it('should set the current route match', () => {
      const mockMatch = { path: '/dashboard', params: {} } as any;

      store.getState().navigation.setCurrentRouteMatch(mockMatch);

      expect(store.getState().navigation.currentRouteMatch).toBe(mockMatch);
    });

    it('should allow setting to null', () => {
      const mockMatch = { path: '/dashboard', params: {} } as any;

      store.getState().navigation.setCurrentRouteMatch(mockMatch);
      expect(store.getState().navigation.currentRouteMatch).toBe(mockMatch);

      store.getState().navigation.setCurrentRouteMatch(null);
      expect(store.getState().navigation.currentRouteMatch).toBe(null);
    });
  });

  describe('navigatePreservingContext', () => {
    it('should do nothing when navigate is not set', () => {
      // Should not throw even without navigate function
      expect(() => {
        store.getState().navigation.navigatePreservingContext('/dashboard');
      }).not.toThrow();
    });

    it('should call navigate when set', () => {
      const mockNavigate = vi.fn();
      store.getState().navigation.setNavigate(mockNavigate as any);

      store.getState().navigation.navigatePreservingContext('/dashboard');

      expect(mockNavigate).toHaveBeenCalled();
    });

    it('should parse path without search params', () => {
      const mockNavigate = vi.fn();
      store.getState().navigation.setNavigate(mockNavigate as any);

      store.getState().navigation.navigatePreservingContext('/dashboard');

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' });
    });

    it('should handle paths with hash', () => {
      const mockNavigate = vi.fn();
      store.getState().navigation.setNavigate(mockNavigate as any);

      store.getState().navigation.navigatePreservingContext('/dashboard#section');

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard#section' });
    });
  });

  describe('navigatePreservingSpoof', () => {
    it('should do nothing when navigate is not set', () => {
      // Should not throw even without navigate function
      expect(() => {
        store.getState().navigation.navigatePreservingSpoof('/dashboard');
      }).not.toThrow();
    });

    it('should call navigate when set', () => {
      const mockNavigate = vi.fn();
      store.getState().navigation.setNavigate(mockNavigate as any);

      store.getState().navigation.navigatePreservingSpoof('/dashboard');

      expect(mockNavigate).toHaveBeenCalled();
    });

    it('should preserve spoof from auth state', () => {
      const mockNavigate = vi.fn();
      store.getState().navigation.setNavigate(mockNavigate as any);

      store.setState({
        auth: {
          ...store.getState().auth,
          spoofUserEmail: 'admin@example.com',
        },
      });

      store.getState().navigation.navigatePreservingSpoof('/dashboard');

      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/dashboard',
        search: { spoof: 'admin@example.com' },
      });
    });
  });
});
