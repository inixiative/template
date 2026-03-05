import type { Story } from '@ladle/react';
import { Alert } from '@template/ui/components/primitives/Alert';
import { Button } from '@template/ui/components/primitives/Button';
import { FormField } from '@template/ui/components/primitives/FormField';
import { Input } from '@template/ui/components/primitives/Input';

export const SettingsPage: Story = () => {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">Profile</h2>
        <FormField label="Display name">
          <Input value="Aron Greenspan" onChange={() => {}} />
        </FormField>
        <FormField label="Email">
          <Input value="aron@example.com" type="email" onChange={() => {}} />
        </FormField>
        <div className="flex justify-end">
          <Button>Save changes</Button>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-error bg-card p-6">
        <h2 className="text-xl font-semibold text-error">Danger zone</h2>
        <Alert tone="warning" title="Permanent action">
          Deleting the account cannot be undone.
        </Alert>
        <div className="flex justify-end">
          <Button variant="destructive">Delete account</Button>
        </div>
      </section>
    </div>
  );
};
