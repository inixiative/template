import { createFileRoute } from '@tanstack/react-router';
import { ComingSoon } from '@template/ui/components';

const ContentPage = () => {
  return (
    <div className="container mx-auto px-4 py-16">
      <ComingSoon
        title="Content Library"
        description="Explore our public content, resources, and documentation."
      />
    </div>
  );
};

export const Route = createFileRoute('/_public/content')({
  component: ContentPage,
});
