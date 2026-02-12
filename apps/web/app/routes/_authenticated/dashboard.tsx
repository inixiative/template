import { createFileRoute } from '@tanstack/react-router';
import { usePageMeta } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import { Card, CardContent, CardHeader, CardTitle } from '@template/ui/components';

const DashboardPage = () => {
  const context = useAppStore((state) => state.tenant.context);
  const { title, description } = usePageMeta();

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Context: <span className="font-mono">{context.type}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});
