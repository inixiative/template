/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { Icon } from '@iconify/react';
import type { MeTwoFactorResponses } from '@template/sdk';
import { Button } from '@template/ui/components/primitives/Button';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';
import { useState } from 'react';

type PasskeySummary = MeTwoFactorResponses[200]['data']['passkeys'][number];

type PasskeyListSectionProps = {
  passkeys: PasskeySummary[];
  canDeleteLastPasskey: boolean;
  isBusy: boolean;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'Never');

export const PasskeyListSection = ({
  passkeys,
  canDeleteLastPasskey,
  isBusy,
  onAdd,
  onRename,
  onDelete,
}: PasskeyListSectionProps) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = async () => {
    await onAdd(newName.trim() || 'Passkey');
    setNewName('');
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    await onRename(id, trimmed);
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <h4 className="text-sm font-medium">Passkeys</h4>
        <p className="text-xs text-muted-foreground">
          Use Touch ID, Face ID, Windows Hello, or a hardware security key as your second factor.
        </p>
      </div>

      {passkeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">No passkeys registered yet.</p>
      ) : (
        <ul className="space-y-2">
          {passkeys.map((passkey) => {
            const isLastBlocked = passkeys.length === 1 && !canDeleteLastPasskey;
            return (
              <li
                key={passkey.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  {editingId === passkey.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 max-w-xs"
                        disabled={isBusy}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleSaveRename(passkey.id)}
                        disabled={isBusy}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <p className="truncate text-sm font-medium">{passkey.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Added {formatDate(passkey.createdAt)} · Last used{' '}
                    {formatDate(passkey.lastUsedAt)}
                  </p>
                </div>

                {editingId !== passkey.id && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isBusy}
                      onClick={() => {
                        setEditingId(passkey.id);
                        setEditingName(passkey.name);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isBusy || isLastBlocked}
                      title={
                        isLastBlocked
                          ? 'Add another factor before removing your last one'
                          : undefined
                      }
                      onClick={() => void onDelete(passkey.id)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-passkey-name" className="text-xs">
            New passkey name
          </Label>
          <Input
            id="new-passkey-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="MacBook Touch ID"
            disabled={isBusy}
          />
        </div>
        <Button type="button" variant="outline" onClick={() => void handleAdd()} disabled={isBusy}>
          <Icon icon="lucide:key-round" className="mr-2 h-4 w-4" />
          Add passkey
        </Button>
      </div>
    </div>
  );
};
