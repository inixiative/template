/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */

/** A permission rule stored on a tenant that the library would refuse: its owner has to set it again. */
export class StoredPermissionRuleRefusedError extends Error {
  override name = 'StoredPermissionRuleRefusedError';
}
