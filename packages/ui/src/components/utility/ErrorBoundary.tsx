import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '@template/ui/components/primitives/Card';
import { Component, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) return <RouteError error={this.state.error} />;
    return this.props.children;
  }
}

export const RouteError = ({ error }: { error: unknown }) => {
  const err = error instanceof Error ? error : new Error(String(error));
  return (
    <div className="p-8">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Icon icon="lucide:alert-triangle" className="h-5 w-5 shrink-0" />
            {err.message}
          </CardTitle>
        </CardHeader>
        {err.stack && (
          <CardContent>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all bg-muted p-4 rounded-md overflow-auto">
              {err.stack}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  );
};
