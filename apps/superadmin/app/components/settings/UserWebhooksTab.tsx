import { Button, Card, CardContent, CardHeader, CardTitle } from '@template/ui/components';

export const UserWebhooksTab = () => {
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Platform Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Configure platform-level webhooks for system events</p>
          <Button>Create Webhook</Button>
        </CardContent>
      </Card>
    </div>
  );
};
