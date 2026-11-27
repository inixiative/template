/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import {
  type PublicKeyCredentialCreationOptionsJSON,
  startRegistration,
} from '@simplewebauthn/browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  meTwoFactor,
  meTwoFactorBackupCodesRegenerate,
  meTwoFactorPasskeyConfirm,
  meTwoFactorPasskeyDelete,
  meTwoFactorPasskeyOptions,
  meTwoFactorPasskeyRename,
  meTwoFactorQueryKey,
  meTwoFactorTotpConfirm,
  meTwoFactorTotpDisable,
  meTwoFactorTotpStart,
} from '@template/sdk';
import { BackupCodesRevealModal } from '@template/ui/components/auth/BackupCodesRevealModal';
import { FormErrorAlert } from '@template/ui/components/auth/FormErrorAlert';
import type { TotpSetupState } from '@template/ui/components/auth/TotpEnrollForm';
import { Badge } from '@template/ui/components/primitives/Badge';
import { Button } from '@template/ui/components/primitives/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives/Card';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';
import { BackupCodesSection } from '@template/ui/components/settings/BackupCodesSection';
import { PasskeyListSection } from '@template/ui/components/settings/PasskeyListSection';
import { TotpSettingsSection } from '@template/ui/components/settings/TotpSettingsSection';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { isTwoFactorReverifyError } from '@template/ui/lib/auth/twoFactor';
import { describeError } from '@template/ui/lib/describeError';
import { navigateToTwoFactorReverify } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';
import { useState } from 'react';

const isCancelled = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'NotAllowedError');

export const TwoFactorSecurityCard = ({ onEnrolled }: { onEnrolled?: () => void } = {}) => {
  const queryClient = useQueryClient();
  const applyUpgradedJwt = useAppStore((state) => state.auth.applyUpgradedJwt);
  const { data, isLoading } = useQuery({
    queryKey: meTwoFactorQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meTwoFactor>[0]) => meTwoFactor(opts)),
  });
  const status = data?.data;

  const [currentPassword, setCurrentPassword] = useState('');
  const [totpSetup, setTotpSetup] = useState<TotpSetupState | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<string[] | null>(null);

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: meTwoFactorQueryKey() });
  const needsPassword = Boolean(status && !status.enabled && status.hasPassword);

  const actionMutation = useMutation({
    throwOnError: false,
    meta: { skipErrorToast: true },
    mutationFn: (fn: () => Promise<void>) => fn(),
  });

  const errorMessage =
    actionMutation.error && !isCancelled(actionMutation.error)
      ? (() => {
          const described = describeError(actionMutation.error, 'Two-factor update failed');
          return described.detail || described.message;
        })()
      : null;

  const finishEnrollment = async (
    jwt: { token: string; expiresAt: string } | undefined,
    backupCodes: string[] | null | undefined,
  ) => {
    applyUpgradedJwt(jwt, !onEnrolled);
    await refreshStatus();
    if (backupCodes?.length) {
      setRevealedCodes(backupCodes);
      return;
    }
    onEnrolled?.();
  };

  const handleStartTotp = () =>
    actionMutation.mutate(async () => {
      const res = await apiMutation((opts: Parameters<typeof meTwoFactorTotpStart>[0]) =>
        meTwoFactorTotpStart({
          ...opts,
          throwOnError: true,
          body: needsPassword ? { currentPassword } : {},
        }),
      )();
      setTotpSetup({ secret: res.data.secret, otpauthUri: res.data.otpauthUri });
      setCurrentPassword('');
    });

  const handleConfirmTotp = async (code: string) => {
    const res = await apiMutation((opts: Parameters<typeof meTwoFactorTotpConfirm>[0]) =>
      meTwoFactorTotpConfirm({ ...opts, throwOnError: true, body: { code } }),
    )();
    setTotpSetup(null);
    await finishEnrollment(res.data.jwt, res.data.backupCodes);
  };

  const handleAddPasskey = (name: string) =>
    actionMutation.mutateAsync(async () => {
      const optsRes = await apiMutation((opts: Parameters<typeof meTwoFactorPasskeyOptions>[0]) =>
        meTwoFactorPasskeyOptions({
          ...opts,
          throwOnError: true,
          body: needsPassword ? { currentPassword } : {},
        }),
      )();
      const response = await startRegistration({
        optionsJSON: optsRes.data.options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });
      const res = await apiMutation((opts: Parameters<typeof meTwoFactorPasskeyConfirm>[0]) =>
        meTwoFactorPasskeyConfirm({
          ...opts,
          throwOnError: true,
          body: {
            name,
            response: response as unknown as Parameters<
              typeof meTwoFactorPasskeyConfirm
            >[0]['body']['response'],
          },
        }),
      )();
      setCurrentPassword('');
      await finishEnrollment(res.data.jwt, res.data.backupCodes);
    });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>
                Protect your account with passkeys and an authenticator app.
              </CardDescription>
            </div>
            {status && (
              <Badge variant={status.enabled ? 'default' : 'secondary'}>
                {status.enabled ? 'Enabled' : status.required ? 'Required' : 'Off'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4" isLoading={isLoading || !status}>
          {status && (
            <>
              {errorMessage && (
                <FormErrorAlert
                  message={errorMessage}
                  action={
                    isTwoFactorReverifyError(actionMutation.error) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => navigateToTwoFactorReverify(useAppStore.getState)}
                      >
                        Verify 2FA
                      </Button>
                    )
                  }
                />
              )}
              {needsPassword && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <Label htmlFor="two-factor-current-password">
                    Current password (required for initial setup)
                  </Label>
                  <Input
                    id="two-factor-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={actionMutation.isPending}
                  />
                </div>
              )}
              <TotpSettingsSection
                totpEnabled={status.totpEnabled}
                canDisableTotp={!status.required || status.passkeys.length > 0}
                totpSetup={totpSetup}
                isBusy={actionMutation.isPending}
                onStart={handleStartTotp}
                onConfirm={handleConfirmTotp}
                onCancelSetup={() => setTotpSetup(null)}
                onDisable={() =>
                  actionMutation.mutate(async () => {
                    await apiMutation((opts: Parameters<typeof meTwoFactorTotpDisable>[0]) =>
                      meTwoFactorTotpDisable(opts),
                    )();
                    await refreshStatus();
                  })
                }
              />
              <PasskeyListSection
                passkeys={status.passkeys}
                canDeleteLastPasskey={!status.required || status.totpEnabled}
                isBusy={actionMutation.isPending}
                onAdd={handleAddPasskey}
                onRename={(passkeyId, name) =>
                  actionMutation.mutateAsync(async () => {
                    await apiMutation((opts: Parameters<typeof meTwoFactorPasskeyRename>[0]) =>
                      meTwoFactorPasskeyRename({ ...opts, body: { passkeyId, name } }),
                    )();
                    await refreshStatus();
                  })
                }
                onDelete={(passkeyId) =>
                  actionMutation.mutateAsync(async () => {
                    await apiMutation((opts: Parameters<typeof meTwoFactorPasskeyDelete>[0]) =>
                      meTwoFactorPasskeyDelete({ ...opts, body: { passkeyId } }),
                    )();
                    await refreshStatus();
                  })
                }
              />
              <BackupCodesSection
                remaining={status.backupCodesRemaining}
                enabled={status.enabled}
                isBusy={actionMutation.isPending}
                onRegenerate={() =>
                  actionMutation.mutateAsync(async () => {
                    const res = await apiMutation(
                      (opts: Parameters<typeof meTwoFactorBackupCodesRegenerate>[0]) =>
                        meTwoFactorBackupCodesRegenerate({ ...opts, throwOnError: true }),
                    )();
                    if (res.data.backupCodes.length) setRevealedCodes(res.data.backupCodes);
                    await refreshStatus();
                  })
                }
              />
            </>
          )}
        </CardContent>
      </Card>
      {revealedCodes && (
        <BackupCodesRevealModal
          codes={revealedCodes}
          onDismiss={() => {
            setRevealedCodes(null);
            onEnrolled?.();
          }}
        />
      )}
    </>
  );
};
