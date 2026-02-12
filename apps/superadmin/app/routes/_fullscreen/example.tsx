import { createFileRoute } from '@tanstack/react-router';

const ExampleFullscreenPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold mb-4">Fullscreen Example</h1>
        <p className="text-muted-foreground mb-8">
          This page uses the fullscreen layout - no AppShell, just a back button.
        </p>
        <div className="bg-card p-8 rounded-lg border">
          <p>Perfect for:</p>
          <ul className="list-disc list-inside mt-4 space-y-2">
            <li>Invoice/receipt views</li>
            <li>Document previews</li>
            <li>Print layouts</li>
            <li>Embedded views</li>
            <li>Focused workflows</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute('/_fullscreen/example')({
  component: ExampleFullscreenPage,
});
