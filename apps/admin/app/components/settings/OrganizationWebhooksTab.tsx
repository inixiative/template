import { Button, Card, CardContent, CardHeader, CardTitle } from '@template/ui/components';

export const OrganizationWebhooksTab = ({ organizationId }: { organizationId: string }) => {
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Configure webhooks for this organization</p>
          <Button>Create Webhook</Button>
        </CardContent>
      </Card>
    </div>
  );
};
