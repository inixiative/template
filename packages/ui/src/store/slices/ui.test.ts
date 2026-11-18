import { beforeEach, describe, expect, it } from 'bun:test';
import { createTestStore } from '@template/ui/test';

describe('ui slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const { ui } = store.getState();

      expect(ui.theme).toBe('system');
      expect(ui.appName).toBe('App');
      expect(ui.shortName).toBe('Template');
      expect(ui.description).toBe('TanStack Router + React Aria + Tailwind');
    });

    it('should have required methods', () => {
      const { ui } = store.getState();

      expect(typeof ui.setTheme).toBe('function');
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
          appName: 'Renamed',
        },
      });

      store.getState().ui.setTheme('dark');

      const { ui } = store.getState();
      expect(ui.theme).toBe('dark');
      expect(ui.appName).toBe('Renamed');
    });
  });
});
