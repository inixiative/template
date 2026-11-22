/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { TwoFactorVerifyForm } from '@template/ui/components/auth/TwoFactorVerifyForm';
import { Modal } from '@template/ui/components/layout/Modal';
import { useAppStore } from '@template/ui/store';

export const TwoFactorVerifyModal = () => {
  const request = useAppStore((state) => state.auth.twoFactorVerifyRequest);
  const applyUpgradedJwt = useAppStore((state) => state.auth.applyUpgradedJwt);
  const resolveTwoFactorVerify = useAppStore((state) => state.auth.resolveTwoFactorVerify);
  const cancelTwoFactorVerify = useAppStore((state) => state.auth.cancelTwoFactorVerify);

  if (!request) return null;

  return (
    <Modal open onClose={cancelTwoFactorVerify} title="Verify your identity" size="small">
      <p className="mb-4 text-sm text-muted-foreground">
        Confirm with your second factor to continue.
      </p>
      <TwoFactorVerifyForm
        methods={request.methods}
        onVerified={(jwt) => {
          applyUpgradedJwt(jwt, false);
          resolveTwoFactorVerify();
        }}
        submitLabel="Verify and continue"
      />
    </Modal>
  );
};
