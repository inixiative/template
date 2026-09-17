/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import { isValidBindingIdentifier, RESERVED_BINDING_NAMES } from '@template/email/render/conditionParser';

export const bindsAs = (name: string | undefined): name is string =>
  name !== undefined && isValidBindingIdentifier(name) && !RESERVED_BINDING_NAMES.has(name);
