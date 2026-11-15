import { describe, expect, it } from 'bun:test';
import type { Lens } from '@inixiative/json-rules';
import { EntitlementResourceModel } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { validateEntitlementLens } from '#/lib/permissions/validateEntitlementLens';

const resource = EntitlementResourceModel.Organization;

describe('the base lens an entitlement lens narrows comes from a resolver', () => {
  it('narrows the lens the resolver returns for the row resource', () => {
    const asked: EntitlementResourceModel[] = [];
    const baseLensOf = (model: EntitlementResourceModel): Lens => {
      asked.push(model);
      return lensFor(EntitlementResourceModel.User);
    };
    expect(() =>
      validateEntitlementLens({ resource, lens: { root: { picks: ['id', 'email'] } } }, baseLensOf),
    ).not.toThrow();
    expect(asked).toEqual([resource]);
    expect(() =>
      validateEntitlementLens({ resource, lens: { root: { picks: ['id', 'email'] } } }),
    ).toThrow('not a valid narrowing');
  });

  it('refuses a lens on a resource the resolver has no base lens for', () => {
    expect(() => validateEntitlementLens({ resource, lens: { root: {} } }, () => null)).toThrow(
      `${resource} takes no lens`,
    );
    expect(() => validateEntitlementLens({ resource, lens: null }, () => null)).not.toThrow();
  });
});
