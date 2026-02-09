import { Button } from '@template/ui/components/Button';
import { ResponsiveDrawer } from '@template/ui/components/layout/ResponsiveDrawer';
import { useState } from 'react';

export const ResponsiveDrawerExample = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Details</Button>

      <ResponsiveDrawer open={isOpen} onClose={() => setIsOpen(false)} title="User Details">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Name</h3>
            <p>John Doe</p>
          </div>
          <div>
            <h3 className="font-semibold">Email</h3>
            <p>john@example.com</p>
          </div>
          <div>
            <h3 className="font-semibold">Role</h3>
            <p>Admin</p>
          </div>
        </div>
      </ResponsiveDrawer>
    </div>
  );
};

export const ResponsiveDrawerWithCustomBreakpoint = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Settings</Button>

      <ResponsiveDrawer open={isOpen} onClose={() => setIsOpen(false)} title="Settings" breakpoint="lg">
        <div className="space-y-4">
          <p>
            This drawer switches to a modal at the lg breakpoint (1024px) instead of the default md breakpoint (768px).
          </p>
        </div>
      </ResponsiveDrawer>
    </div>
  );
};

export const ResponsiveDrawerNoTitle = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Quick View</Button>

      <ResponsiveDrawer open={isOpen} onClose={() => setIsOpen(false)}>
        <div>
          <p>Content without a title</p>
        </div>
      </ResponsiveDrawer>
    </div>
  );
};
