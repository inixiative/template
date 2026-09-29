/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '@template/ui/components/primitives/Card';
import { reportBrowserError } from '@template/ui/lib/browserTelemetry';
import { describeError } from '@template/ui/lib/describeError';
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
    reportBrowserError(error);
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) return <RouteError error={this.state.error} />;
    return this.props.children;
  }
}

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
