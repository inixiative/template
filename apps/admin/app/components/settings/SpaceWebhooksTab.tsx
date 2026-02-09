import { Button, Card, CardContent, CardHeader, CardTitle } from '@template/ui';

export const SpaceWebhooksTab = ({ spaceId }: { spaceId: string }) => {
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Configure webhooks for this space</p>
          <Button>Create Webhook</Button>
        </CardContent>
      </Card>
    </div>
  );
};
