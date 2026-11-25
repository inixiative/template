/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { TotpEnrollForm, type TotpSetupState } from '@template/ui/components/auth/TotpEnrollForm';
import { Button } from '@template/ui/components/primitives/Button';

type TotpSettingsSectionProps = {
  totpEnabled: boolean;
  canDisableTotp: boolean;
  totpSetup: TotpSetupState | null;
  isBusy: boolean;
  onStart: () => void;
  onConfirm: (code: string) => Promise<void>;
  onCancelSetup: () => void;
  onDisable: () => void;
};

export const TotpSettingsSection = ({
  totpEnabled,
  canDisableTotp,
  totpSetup,
  isBusy,
  onStart,
  onConfirm,
  onCancelSetup,
  onDisable,
}: TotpSettingsSectionProps) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h4 className="text-sm font-medium">Authenticator app (TOTP)</h4>
        <p className="text-xs text-muted-foreground">
          {totpEnabled ? 'Active. Use any 6-digit TOTP authenticator app.' : 'Not configured.'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={onStart}>
          {totpEnabled ? 'Rotate app' : 'Set up app'}
        </Button>
        {totpEnabled && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isBusy || !canDisableTotp}
            title={
              canDisableTotp ? undefined : 'Add a passkey before removing your authenticator app'
            }
            onClick={onDisable}
          >
            Remove
          </Button>
        )}
      </div>
    </div>

    {totpSetup && (
      <TotpEnrollForm setup={totpSetup} onConfirm={onConfirm} onCancel={onCancelSetup} />
    )}
  </div>
);
