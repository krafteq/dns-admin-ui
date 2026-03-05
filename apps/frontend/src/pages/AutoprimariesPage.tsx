import { useState } from 'react';
import { Server, Plus, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirm } from '@/hooks/use-confirm';

type Autoprimary = { ip: string; nameserver: string; account?: string };

function AddAutoprimaryDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [ip, setIp] = useState('');
  const [nameserver, setNameserver] = useState('');
  const [account, setAccount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.pdns.autoprimaries.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setIp('');
      setNameserver('');
      setAccount('');
      setError(null);
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate({ ip, nameserver, account: account || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Autoprimary
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Autoprimary</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>IP Address</Label>
            <Input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="192.168.1.1"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Nameserver</Label>
            <Input
              value={nameserver}
              onChange={(e) => setNameserver(e.target.value)}
              placeholder="ns1.example.com."
              className="font-mono"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Account <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={account} onChange={(e) => setAccount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AutoprimariesPage() {
  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();
  const { state: confirmState, confirm, setOpen: setConfirmOpen } = useConfirm();

  const { data, isLoading, error } = trpc.pdns.autoprimaries.list.useQuery(undefined, {
    retry: false,
  });

  const deleteMutation = trpc.pdns.autoprimaries.delete.useMutation({
    onSuccess: () => utils.pdns.autoprimaries.list.invalidate(),
  });

  const autoprimaries = (data as Autoprimary[]) ?? [];

  const handleDelete = (ip: string, nameserver: string) => {
    confirm({
      title: 'Delete Autoprimary',
      description: `Are you sure you want to delete autoprimary ${ip} / ${nameserver}?`,
      onConfirm: () => deleteMutation.mutate({ ip, nameserver }),
    });
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={setConfirmOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Delete"
        onConfirm={confirmState.onConfirm}
        isPending={deleteMutation.isPending}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Autoprimaries</h1>
          <p className="text-muted-foreground mt-1">
            Trusted primary servers for automatic secondary zone creation
          </p>
        </div>
        {isAdmin && (
          <AddAutoprimaryDialog onSuccess={() => utils.pdns.autoprimaries.list.invalidate()} />
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Autoprimaries ({autoprimaries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Nameserver</TableHead>
                  <TableHead>Account</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoprimaries.map((ap) => (
                  <TableRow key={`${ap.ip}-${ap.nameserver}`}>
                    <TableCell className="font-mono">{ap.ip}</TableCell>
                    <TableCell className="font-mono">{ap.nameserver}</TableCell>
                    <TableCell>
                      {ap.account ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete autoprimary ${ap.ip}`}
                          onClick={() => handleDelete(ap.ip, ap.nameserver)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {autoprimaries.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 4 : 3}
                      className="text-center text-muted-foreground"
                    >
                      No autoprimaries configured
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
