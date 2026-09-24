/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { MeCreateWebhookSubscriptionData } from '@template/sdk';
import { Button, Input, Label, Modal, Select } from '@template/ui/components';
import { enumToSelectOptions } from '@template/ui/lib/enumOptions';
import { memo, useState } from 'react';

type CreateWebhookFormData = Pick<MeCreateWebhookSubscriptionData['body'], 'model' | 'url'>;
type WebhookModel = CreateWebhookFormData['model'];

const webhookModelValues = ['CustomerRef'] as const satisfies readonly WebhookModel[];
const webhookModelOptions = enumToSelectOptions<WebhookModel>(webhookModelValues);

const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

type CreateWebhookModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateWebhookFormData) => void;
};

export const CreateWebhookModal = memo(({ isOpen, onClose, onSubmit }: CreateWebhookModalProps) => {
  const [url, setUrl] = useState('');
  const [model, setModel] = useState<WebhookModel>(webhookModelValues[0]);
  const trimmedUrl = url.trim();
  const canSubmit = isHttpUrl(trimmedUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ url: trimmedUrl, model });
    setUrl('');
    setModel(webhookModelValues[0]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create webhook">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Endpoint URL</Label>
          <Input
            id="webhook-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">We send a signed POST request here when the model changes.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhook-model">Model</Label>
          <Select id="webhook-model" value={model} onChange={setModel} options={webhookModelOptions} />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            Create webhook
          </Button>
        </div>
      </form>
    </Modal>
  );
});
