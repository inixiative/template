/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { passwordLength } from '@template/shared/auth/passwordLength';
import { Label } from '@template/ui/components/primitives/Label';
import { PasswordInput } from '@template/ui/components/primitives/PasswordInput';

export type NewPasswordFieldsProps = {
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (newPassword: string) => void;
  onConfirmPasswordChange: (confirmPassword: string) => void;
  disabled: boolean;
};

export const NewPasswordFields = ({
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  disabled,
}: NewPasswordFieldsProps) => (
  <>
    <div className="space-y-2">
      <Label htmlFor="new-password">New password</Label>
      <PasswordInput
        id="new-password"
        autoComplete="new-password"
        minLength={passwordLength.min}
        maxLength={passwordLength.max}
        value={newPassword}
        onChange={(event) => onNewPasswordChange(event.target.value)}
        required
        disabled={disabled}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="confirm-password">Confirm new password</Label>
      <PasswordInput
        id="confirm-password"
        autoComplete="new-password"
        minLength={passwordLength.min}
        maxLength={passwordLength.max}
        value={confirmPassword}
        onChange={(event) => onConfirmPasswordChange(event.target.value)}
        required
        disabled={disabled}
      />
    </div>
  </>
);
