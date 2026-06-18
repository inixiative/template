import { describe, expect, it } from 'bun:test';
import type { Db } from '@template/db/clientTypes';
import { fetchLens } from '@template/db/hydrate/fetchLens';
import { lensFor } from '@template/db/lens/lensFor';

describe('fetchLens', () => {
  it('fails closed on an unscoped lens (no where) before touching the db', async () => {
    await expect(fetchLens({} as Db, lensFor('Inquiry'))).rejects.toThrow();
  });
});
