/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import {
  isValidBindingIdentifier,
  RESERVED_BINDING_NAMES,
} from '@template/email/render/conditionParser/grammar';

export const bindsAs = (name: string | undefined): name is string =>
  name !== undefined && isValidBindingIdentifier(name) && !RESERVED_BINDING_NAMES.has(name);
