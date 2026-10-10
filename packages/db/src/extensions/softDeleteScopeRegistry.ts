/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

let registered = false;

export const registerSoftDeleteScope = (): void => {
  registered = true;
};

export const unregisterSoftDeleteScope = (): void => {
  registered = false;
};

export const isSoftDeleteScopeRegistered = (): boolean => registered;
