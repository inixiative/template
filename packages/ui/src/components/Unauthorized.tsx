import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';

export type UnauthorizedProps = {
  title?: string;
  message?: string;
  onGoBack?: () => void;
  onGoHome?: () => void;
};

export const Unauthorized = ({
  title = 'Access Denied',
  message = "You don't have permission to access this page in the current context.",
  onGoBack,
  onGoHome,
}: UnauthorizedProps) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle>{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message}</p>
          <div className="flex gap-2">
            {onGoBack && (
              <Button variant="outline" onClick={onGoBack}>
                Go Back
              </Button>
            )}
            {onGoHome && (
              <Button onClick={onGoHome}>Go to Dashboard</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
