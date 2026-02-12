import { createTestStore } from '@template/ui/test';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ui slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const { ui } = store.getState();

      expect(ui.theme).toBe('system');
      expect(ui.isLoading).toBe(false);
      expect(ui.appName).toBe('Template');
      expect(ui.shortName).toBe('Template');
      expect(ui.description).toBe('TanStack Router + React Aria + Tailwind');
    });

    it('should have required methods', () => {
      const { ui } = store.getState();

      expect(typeof ui.setTheme).toBe('function');
      expect(typeof ui.setLoading).toBe('function');
      expect(typeof ui.updateTheme).toBe('function');
    });
  });

  describe('setTheme', () => {
    it('should update theme to light', () => {
      store.getState().ui.setTheme('light');

      expect(store.getState().ui.theme).toBe('light');
    });

    it('should update theme to dark', () => {
      store.getState().ui.setTheme('dark');

      expect(store.getState().ui.theme).toBe('dark');
    });

    it('should update theme to system', () => {
      // Set to dark first
      store.getState().ui.setTheme('dark');
      expect(store.getState().ui.theme).toBe('dark');

      // Set back to system
      store.getState().ui.setTheme('system');
      expect(store.getState().ui.theme).toBe('system');
    });

    it('should preserve other UI state when updating theme', () => {
      store.setState({
        ui: {
          ...store.getState().ui,
          isLoading: true,
        },
      });

      store.getState().ui.setTheme('dark');

      const { ui } = store.getState();
      expect(ui.theme).toBe('dark');
      expect(ui.isLoading).toBe(true);
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      store.getState().ui.setLoading(true);

      expect(store.getState().ui.isLoading).toBe(true);
    });

    it('should set loading to false', () => {
      // Set to true first
      store.getState().ui.setLoading(true);
      expect(store.getState().ui.isLoading).toBe(true);

      // Set to false
      store.getState().ui.setLoading(false);
      expect(store.getState().ui.isLoading).toBe(false);
    });

    it('should preserve other UI state when updating loading', () => {
      store.getState().ui.setTheme('dark');

      store.getState().ui.setLoading(true);

      const { ui } = store.getState();
      expect(ui.isLoading).toBe(true);
      expect(ui.theme).toBe('dark');
    });
  });

  describe('updateTheme', () => {
    it('should update theme asynchronously', async () => {
      await store.getState().ui.updateTheme('light');

      expect(store.getState().ui.theme).toBe('light');
    });

    it('should handle multiple theme updates', async () => {
      await store.getState().ui.updateTheme('dark');
      expect(store.getState().ui.theme).toBe('dark');

      await store.getState().ui.updateTheme('light');
      expect(store.getState().ui.theme).toBe('light');

      await store.getState().ui.updateTheme('system');
      expect(store.getState().ui.theme).toBe('system');
    });
  });
});
