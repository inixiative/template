/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  SlugInput,
  ThemeSelector,
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
  showThemeSelector?: boolean;
  isPending?: boolean;
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
  showThemeSelector = false,
  isPending = false,
}: ProfileFormCardProps) => {
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <Skeleton loaded={!isPending}>
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
        </Skeleton>
      </Card>

      {showThemeSelector && (
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeSelector />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
