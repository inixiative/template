/**
 * @atlas
 * @kind constant
 * @partOf feature:email
 * @uses none
 */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export const BLOCK_TAG = /\{\{(#|\/)(component|slot):([a-z0-9-]+)(?::(default))?\}\}/g;

export const componentTagPattern = (): RegExp => new RegExp(BLOCK_TAG.source, BLOCK_TAG.flags);
