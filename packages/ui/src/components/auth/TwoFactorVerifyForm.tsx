/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { Icon } from '@iconify/react';
import {
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
} from '@simplewebauthn/browser';
import { useMutation } from '@tanstack/react-query';
import { meTwoFactorVerify, meTwoFactorVerifyPasskeyOptions } from '@template/sdk';
import type { TwoFactorMethod } from '@template/shared/auth/twoFactor';
import { FormErrorAlert } from '@template/ui/components/auth/FormErrorAlert';
import { Button } from '@template/ui/components/primitives/Button';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';
import { TWO_FACTOR_METHOD_LABELS } from '@template/ui/lib/auth/twoFactor';
import { describeError } from '@template/ui/lib/describeError';
import { makeAuthenticatedApiFetch } from '@template/ui/lib/makeAuthenticatedApiFetch';
import { useAppStore } from '@template/ui/store';
import { type FormEvent, useEffect, useState } from 'react';

type TwoFactorVerifyFormProps = {
  methods: TwoFactorMethod[];
  onVerified: (jwt?: { token: string; expiresAt: string }) => void;
  submitLabel?: string;
};

const isPasskeyCancelled = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'NotAllowedError');

export const TwoFactorVerifyForm = ({
  methods,
  onVerified,
  submitLabel = 'Verify',
}: TwoFactorVerifyFormProps) => {
  const spoofUserEmail = useAppStore((state) => state.auth.spoofUserEmail);
  const [activeMethod, setActiveMethod] = useState<TwoFactorMethod>(methods[0] ?? 'totp');
  const [code, setCode] = useState('');

  const verifyMutation = useMutation({
    throwOnError: false,
    meta: { skipErrorToast: true },
    mutationFn: async (method: TwoFactorMethod) => {
      if (method === 'passkey') {
        const optsRes = await makeAuthenticatedApiFetch(
          (opts: Parameters<typeof meTwoFactorVerifyPasskeyOptions>[0]) =>
            meTwoFactorVerifyPasskeyOptions({ ...opts, throwOnError: true }),
          { spoofUserEmail },
        )();
        const response = await startAuthentication({
          optionsJSON: optsRes.data.options as unknown as PublicKeyCredentialRequestOptionsJSON,
        });
        const res = await makeAuthenticatedApiFetch(
          (opts: Parameters<typeof meTwoFactorVerify>[0]) =>
            meTwoFactorVerify({
              ...opts,
              throwOnError: true,
              body: {
                method: 'passkey',
                response: response as unknown as NonNullable<
                  Parameters<typeof meTwoFactorVerify>[0]['body']['response']
                >,
              },
            }),
          { spoofUserEmail },
        )();
        return res.data.jwt;
      }

      const res = await makeAuthenticatedApiFetch(
        (opts: Parameters<typeof meTwoFactorVerify>[0]) =>
          meTwoFactorVerify({ ...opts, throwOnError: true, body: { method, code } }),
        { spoofUserEmail },
      )();
      return res.data.jwt;
    },
    onSuccess: (jwt) => {
      setCode('');
      onVerified(jwt);
    },
  });

  const methodsKey = methods.join(',');

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the method list actually changes
  useEffect(() => {
    setActiveMethod(methods[0] ?? 'totp');
    setCode('');
    verifyMutation.reset();
  }, [methodsKey]);

  const errorMessage =
    verifyMutation.error && !isPasskeyCancelled(verifyMutation.error)
      ? (() => {
          const described = describeError(verifyMutation.error, 'Verification failed');
          return described.detail || described.message;
        })()
      : null;

  const handleCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeMethod === 'passkey') return;
    verifyMutation.mutate(activeMethod);
  };

  return (
    <div className="space-y-4">
      {methods.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {methods.map((method) => (
            <Button
              key={method}
              type="button"
              size="sm"
              variant={activeMethod === method ? 'default' : 'outline'}
              disabled={verifyMutation.isPending}
              onClick={() => {
                setActiveMethod(method);
                setCode('');
                verifyMutation.reset();
              }}
            >
              {TWO_FACTOR_METHOD_LABELS[method]}
            </Button>
          ))}
        </div>
      )}

      {errorMessage && <FormErrorAlert message={errorMessage} />}

      {activeMethod === 'passkey' ? (
        <Button
          type="button"
          className="w-full"
          onClick={() => verifyMutation.mutate('passkey')}
          disabled={verifyMutation.isPending}
        >
          <Icon icon="lucide:key-round" className="mr-2 h-4 w-4" />
          {verifyMutation.isPending ? 'Waiting for passkey…' : 'Verify with passkey'}
        </Button>
      ) : (
        <form onSubmit={handleCodeSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="two-factor-verify-code">
              {activeMethod === 'totp' ? '6-digit authenticator code' : 'Backup recovery code'}
            </Label>
            <Input
              id="two-factor-verify-code"
              type="text"
              inputMode={activeMethod === 'totp' ? 'numeric' : 'text'}
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={activeMethod === 'totp' ? '123456' : 'XXXX-XXXX-XXXX-XXXX'}
              required
              disabled={verifyMutation.isPending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={verifyMutation.isPending}>
            {verifyMutation.isPending ? 'Verifying…' : submitLabel}
          </Button>
        </form>
      )}
    </div>
  );
};
