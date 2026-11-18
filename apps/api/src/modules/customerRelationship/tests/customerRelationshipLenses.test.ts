import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { bindLens, type LensNarrowing, Operator, validateNarrowing } from '@inixiative/json-rules';
import { polymorphicBindings } from '@template/db';
import { customerRelationshipLens } from '#/modules/customerRelationship/lib/lenses/customerRelationshipLens';
import { customerRelationshipsByIdLens } from '#/modules/customerRelationship/lib/lenses/customerRelationshipsByIdLens';
import { lensOutput } from '#tests/utils/lensOutput';

const OWNER = '00000000-0000-7000-8000-0000000000aa';
const IDS = ['00000000-0000-7000-8000-0000000000b1', '00000000-0000-7000-8000-0000000000b2'];
const OWNER_MODELS = ['Organization', 'Space', 'User'] as const;

const DECLARED_BY_THE_DELETED_CUSTOMER_BUILDER =
  'b411b1b12ea0cced9c6cee95a41bfa1d8ff9f2c8572ceb12aa7f238dc4278053';

const sortedKeys = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sortedKeys)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, sortedKeys((value as Record<string, unknown>)[key])]),
        )
      : value;

const declaredLayerDigest = (lens: LensNarrowing): string => {
  const { parent: _generatedBase, ...declared } = lens.parent as LensNarrowing;
  return createHash('sha256')
    .update(JSON.stringify(sortedKeys(JSON.parse(JSON.stringify(declared)))))
    .digest('hex');
};

describe('the customer relationship lenses', () => {
  it('each is a valid, serializable static narrowing', () => {
    for (const lens of [customerRelationshipLens, customerRelationshipsByIdLens]) {
      expect(validateNarrowing(lens).errors).toEqual([]);
      expect(JSON.parse(JSON.stringify(lens))).toEqual(lens);
    }
  });

  it('customerRelationshipLens declares exactly the layer the deleted customer() builder produced', () => {
    expect(declaredLayerDigest(customerRelationshipLens)).toBe(
      DECLARED_BY_THE_DELETED_CUSTOMER_BUILDER,
    );
  });

  it('customerRelationshipsByIdLens, bound, is the narrowing hydrateCustomerRelationships assembled per call', () => {
    for (const ownerModel of OWNER_MODELS) {
      const owner = polymorphicBindings(ownerModel, OWNER);
      const perCall: LensNarrowing = {
        parent: bindLens(customerRelationshipLens, owner),
        root: { where: { field: 'id', operator: Operator.in, value: IDS } },
      };
      const bound = bindLens(customerRelationshipsByIdLens, {
        ...owner,
        customerRelationshipIds: IDS,
      });
      expect(lensOutput(bound)).toEqual(lensOutput(perCall));
    }
  });
});
