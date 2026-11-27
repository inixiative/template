/**
 * @atlas
 * @kind utils, error
 * @partOf primitive:ui
 * @uses none
 */
export const assertNewPasswordsMatch = (newPassword: string, confirmPassword: string): void => {
  if (newPassword !== confirmPassword) throw new Error('The new passwords do not match.');
};
