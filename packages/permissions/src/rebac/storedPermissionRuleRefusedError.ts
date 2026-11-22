/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */

/** A rule stored beside the schema's (a row's, or a tenant's above it) that the library refuses: its owner has to set it again. */
export class StoredPermissionRuleRefusedError extends Error {
  override name = 'StoredPermissionRuleRefusedError';
}

// why: the library throws a plain Error; its message is the only mark of a refused stored rule
const theLibrarySaysAStoredRuleIsRefused = "beside the schema's is refused";

export const rethrowingARefusedStoredRule = <Answer>(ask: () => Answer): Answer => {
  try {
    return ask();
  } catch (error) {
    if (error instanceof Error && error.message.includes(theLibrarySaysAStoredRuleIsRefused))
      throw new StoredPermissionRuleRefusedError(error.message, { cause: error });
    throw error;
  }
};
