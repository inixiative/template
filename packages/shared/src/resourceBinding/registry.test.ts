import { describe, expect, test } from 'bun:test';
import { ResourceBindingRegistry, ResourceBindings } from '@template/shared/resourceBinding';

describe('resourceBinding registry', () => {
  test('logo and avatar are single, image-only, and require public', () => {
    for (const type of ['logo', 'avatar'] as const) {
      const def = ResourceBindingRegistry[type];
      expect(def.cardinality).toBe('single');
      expect(def.accepts).toEqual(['image']);
      expect(def.requiresPublic).toBe(true);
    }
  });

  test('every binding type allowed on a resource exists in the registry', () => {
    for (const types of Object.values(ResourceBindings)) {
      for (const type of types) expect(ResourceBindingRegistry).toHaveProperty(type);
    }
  });
});
