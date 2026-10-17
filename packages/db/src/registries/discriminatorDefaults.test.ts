import { describe, expect, it } from 'bun:test';
import {
  discriminatorRequiresValue,
  withDiscriminatorDefaults,
} from '@template/db/registries/discriminatorDefaults';

describe('discriminator defaults', () => {
  it('fills a missing discriminator from its schema default', () => {
    expect(withDiscriminatorDefaults('Tag', { name: 'x' })).toEqual({
      name: 'x',
      ownerModel: 'platform',
    });
    expect(withDiscriminatorDefaults('EmailTemplate', {})).toEqual({ ownerModel: 'default' });
  });

  it('keeps a provided discriminator', () => {
    expect(withDiscriminatorDefaults('Tag', { ownerModel: 'User' })).toEqual({
      ownerModel: 'User',
    });
  });

  it('never invents a value for an axis without a default', () => {
    expect(withDiscriminatorDefaults('Integration', {}).ownerModel).toBeUndefined();
    expect(discriminatorRequiresValue('Integration', 'ownerModel')).toBe(true);
    expect(discriminatorRequiresValue('Tag', 'ownerModel')).toBe(false);
  });
});
