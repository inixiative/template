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

const describeError = (error: unknown): { message: string; detail?: string } => {
  if (error instanceof Error) return { message: error.message, detail: error.stack };
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const message =
      (typeof obj.message === 'string' && obj.message) ||
      (typeof obj.error === 'string' && obj.error) ||
      'Request failed';
    return { message, detail: JSON.stringify(error, null, 2) };
  }
  return { message: String(error) };
};

export const RouteError = ({ error }: { error: unknown }) => {
  const { message, detail } = describeError(error);
  return (
    <div className="p-8">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Icon icon="lucide:alert-triangle" className="h-5 w-5 shrink-0" />
            {message}
          </CardTitle>
        </CardHeader>
        {detail && (
          <CardContent>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all bg-muted p-4 rounded-md overflow-auto">
              {detail}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  );
};
