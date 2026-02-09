import { Button, Input, Label, Modal } from '@template/ui';
import { memo, useState } from 'react';

type InviteUserModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: string) => void;
  title?: string;
  roles?: { value: string; label: string }[];
};

export const InviteUserModal = memo(
  ({
    isOpen,
    onClose,
    onSubmit,
    title = 'Invite User',
    roles = [
      { value: 'member', label: 'Member' },
      { value: 'admin', label: 'Admin' },
      { value: 'owner', label: 'Owner' },
    ],
  }: InviteUserModalProps) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState(roles[0]?.value || 'member');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (email.trim()) {
        onSubmit(email.trim(), role);
        setEmail('');
        setRole(roles[0]?.value || 'member');
        onClose();
      }
    };

    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-email">Email Address</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">An invitation will be sent to this email address</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-role">Role</Label>
            <select
              id="user-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!email.trim()}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    );
  },
);
