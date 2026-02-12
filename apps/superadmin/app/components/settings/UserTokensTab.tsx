import { CreateTokenModal } from '@template/ui/components';
import { checkPermission } from '@template/ui/hooks';
import { Button, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '#/store';

type Token = {
  id: string;
  name: string;
  lastUsed: string | null;
  createdAt: string;
  userId?: string;
};

export const UserTokensTab = () => {
  const [tokens] = useState<Token[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const permissions = useAppStore((state) => state.permissions);
  const auth = useAppStore((state) => state.auth);

  const columns = [
    {
      key: 'name',
      label: 'Name',
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (token: Token) => new Date(token.createdAt).toLocaleDateString(),
    },
    {
      key: 'lastUsed',
      label: 'Last Used',
      render: (token: Token) => (token.lastUsed ? new Date(token.lastUsed).toLocaleDateString() : 'Never'),
    },
    {
      key: 'actions',
      label: '',
      render: (token: Token) => {
        const tokenRecord = { ...token, userId: token.userId || auth.user?.id };

        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(token.id)}
              show={checkPermission(permissions, 'token', tokenRecord, 'leave')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const handleDelete = (tokenId: string) => {
    console.log('Delete token:', tokenId);
  };

  const handleCreate = (name: string) => {
    console.log('Create token:', name);
  };

  return (
    <>
      <div className="max-w-4xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Platform API Tokens</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Create and manage platform administrator API tokens</p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Token
            </Button>
          </CardHeader>
          <CardContent>
            <Table
              columns={columns}
              data={tokens}
              keyExtractor={(token) => token.id}
              emptyMessage="No API tokens created yet"
            />
          </CardContent>
        </Card>
      </div>

      <CreateTokenModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreate}
        title="Create Platform API Token"
      />
    </>
  );
};
