import { describe, expect, it } from 'bun:test';
import { validatePermission } from '#/middleware/validations/validatePermission';

describe('validatePermission with no loaded resource is a configuration error', () => {
  it('throws on the request', async () => {
    const context = { get: () => undefined } as unknown as Parameters<
      ReturnType<typeof validatePermission>
    >[0];
    await expect(validatePermission('read')(context, async () => {})).rejects.toThrow(
      'validatePermission("read") needs a loaded resource',
    );
  });
});
