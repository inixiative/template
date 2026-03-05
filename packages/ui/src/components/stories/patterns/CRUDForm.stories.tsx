import type { Story } from '@ladle/react';
import { Button } from '@template/ui/components/primitives/Button';
import { Checkbox } from '@template/ui/components/primitives/Checkbox';
import { FormField } from '@template/ui/components/primitives/FormField';
import { Input } from '@template/ui/components/primitives/Input';
import { Select } from '@template/ui/components/primitives/Select';
import { Switch } from '@template/ui/components/primitives/Switch';
import { Textarea } from '@template/ui/components/primitives/Textarea';
import { useState } from 'react';

export const CRUDForm: Story = () => {
  const [enabled] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-lg border bg-card p-6">
      <FormField label="Name" required>
        <Input placeholder="Product name" />
      </FormField>

      <FormField label="Category" required>
        <Select
          value="books"
          onChange={() => {}}
          options={[
            { label: 'Books', value: 'books' },
            { label: 'Software', value: 'software' },
            { label: 'Services', value: 'services' },
          ]}
        />
      </FormField>

      <FormField label="Description">
        <Textarea resize="auto" placeholder="Describe this item" />
      </FormField>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Public listing">
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </FormField>
        <FormField label="Feature on homepage">
          <Checkbox checked={isFeatured} onCheckedChange={setIsFeatured} />
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button disabledText={!enabled ? 'Saving…' : undefined}>Save</Button>
      </div>
    </div>
  );
};
