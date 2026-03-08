import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  SlugInput,
  ThemeToggle,
} from '@template/ui/components';

type ProfileFormCardProps = {
  name: string;
  onNameChange?: (value: string) => void;
  slug?: string;
  onSlugChange?: (value: string) => void;
  canEditName?: boolean;
  showSlug?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  readOnlyMessage?: string;
  showThemeToggle?: boolean;
};

export const ProfileFormCard = ({
  name,
  onNameChange,
  slug = '',
  onSlugChange,
  canEditName = true,
  showSlug = false,
  onSave,
  isSaving = false,
  readOnlyMessage,
  showThemeToggle = false,
}: ProfileFormCardProps) => {
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => onNameChange?.(e.target.value)}
              placeholder="Name"
              disabled={!canEditName}
            />
          </div>

          {showSlug && (
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <SlugInput id="slug" value={slug} onChange={onSlugChange} placeholder="my-slug" />
            </div>
          )}

          {onSave && (
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}

          {readOnlyMessage && <p className="text-sm text-muted-foreground">{readOnlyMessage}</p>}
        </CardContent>
      </Card>

      {showThemeToggle && (
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
