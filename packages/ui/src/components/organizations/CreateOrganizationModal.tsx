/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

import { Icon } from '@iconify/react';
import { isSlug, toSlug } from '@template/shared/utils';
import { Button, Input, Label, Modal, SlugInput } from '@template/ui/components';
import { useDebounce, useValidateUniqueness } from '@template/ui/hooks';
import { memo, useState } from 'react';

export const CreateOrganizationModal = memo(
  ({
    isOpen,
    onClose,
    onSubmit,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string, slug: string) => void;
  }) => {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);

    const debouncedSlug = useDebounce(slug, 300);
    const { isAvailable, isChecking } = useValidateUniqueness('organization', 'slug', debouncedSlug);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setName(newName);

      if (!slugTouched) {
        setSlug(toSlug(newName));
      }
    };

    const handleSlugChange = (value: string) => {
      setSlugTouched(true);
      setSlug(value);
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      if (!isSlug(slug)) return;

      if (isChecking || !isAvailable) {
        return;
      }

      if (name.trim() && slug.trim()) {
        onSubmit(name, slug);
        setName('');
        setSlug('');
        setSlugTouched(false);
      }
    };

    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Create Organization">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Enter organization name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <div className="relative">
              <SlugInput
                id="slug"
                value={slug}
                onChange={handleSlugChange}
                className="font-mono text-sm pr-10"
                placeholder="organization-slug"
              />
              {slug && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isChecking ? (
                    <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : isAvailable ? (
                    <Icon icon="lucide:circle-check" className="h-4 w-4 text-green-600" />
                  ) : (
                    <Icon icon="lucide:alert-circle" className="h-4 w-4 text-destructive" />
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Used in URLs. Lowercase letters, numbers, and hyphens only.
            </p>
            {slug && !isAvailable && !isChecking && (
              <p className="text-xs text-destructive mt-1">This slug is already taken</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !slug.trim() || !isAvailable || isChecking}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    );
  },
);
