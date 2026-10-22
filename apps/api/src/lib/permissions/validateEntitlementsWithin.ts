/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses primitive:errors
 */
import type { Entitlements } from '@template/permissions';
import { isEqual } from 'lodash-es';
import { makeError } from '#/lib/errors';

const refuse = (message: string) => makeError({ status: 422, message });

export const validateEntitlementsWithin = (narrower: Entitlements, wider: Entitlements): void => {
  if (narrower === null) {
    if (wider !== null) throw refuse('The resolution widens the grant to everything');
    return;
  }
  if (!wider) throw refuse('The resolution names entitlements the request did not ask for');
  for (const [key, actions] of Object.entries(narrower)) {
    const asked = wider[key];
    if (!asked) throw refuse(`The resolution adds ${key}, which the request did not ask for`);
    for (const [action, value] of Object.entries(actions)) {
      if (!(action in asked) || !isEqual(asked[action], value))
        throw refuse(`The resolution changes ${key}.${action}; it may only drop entries`);
    }
  }
};
