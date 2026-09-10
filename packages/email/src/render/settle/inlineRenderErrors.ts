/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
export const inlineRenderErrors = (): boolean => process.env.EMAIL_INLINE_RENDER_ERRORS === 'true';
