import { describe, expect, it } from 'bun:test';
import { projectByPath } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens/lensFor';
import { omitForeignKeys } from '@template/db/lens/omitForeignKeys';

const fieldsAt = (lens: ReturnType<typeof omitForeignKeys>, path: string): string[] => {
  const byPath = projectByPath(lens);
  const [rootKey] = byPath.keys();
  const visit = byPath.get(path ? `${rootKey}.${path}` : (rootKey as string));
  return Object.keys(visit?.fields ?? {});
};

describe('omitForeignKeys', () => {
  it('drops the FK columns of the root model and keeps the relation', () => {
    const fields = fieldsAt(omitForeignKeys({ parent: lensFor('Space') }), '');
    expect(fields).not.toContain('organizationId');
    expect(fields).toContain('organization');
    expect(fields).toContain('id');
  });

  it('drops FK columns wherever a model appears via relations', () => {
    const lens = omitForeignKeys({
      parent: lensFor('User'),
      root: { relations: { tagAttachments: {} } },
    });
    const fields = fieldsAt(lens, 'tagAttachments');
    expect(fields).not.toContain('tagId');
    expect(fields).not.toContain('userId');
    expect(fields).toContain('tag');
  });
});
