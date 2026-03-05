import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ServerUnavailable } from '@/components/ui/server-unavailable';
import { Checkbox } from '@/components/ui/checkbox';
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

type ForwardZone = {
  id: string;
  name: string;
  kind: string;
  servers?: string[];
  recursion_desired?: boolean;
};

function EditForwarderDialog({
  zone,
  onSuccess,
}: {
  zone: ForwardZone;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState('');
  const [recursionDesired, setRecursionDesired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = trpc.recursor.forwarders.update.useMutation({
    onSuccess: () => {
      setOpen(false);
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setServers(zone.servers?.join(', ') ?? '');
      setRecursionDesired(zone.recursion_desired ?? false);
      setError(null);
    }
    setOpen(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const serverList = servers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateMutation.mutate({
      zoneId: zone.id,
      servers: serverList,
      recursion_desired: recursionDesired,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit forwarder ${zone.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Forwarder — {zone.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Forwarder Servers (comma-separated)</Label>
            <Input
              placeholder="192.168.1.1, 192.168.1.2"
              value={servers}
              onChange={(e) => setServers(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="edit_recursion_desired"
              checked={recursionDesired}
              onCheckedChange={(checked) => setRecursionDesired(checked === true)}
            />
            <Label htmlFor="edit_recursion_desired">Recursion desired</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddForwarderDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [servers, setServers] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.recursor.forwarders.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setName('');
      setServers('');
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const serverList = servers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    createMutation.mutate({
      name: name.endsWith('.') ? name : `${name}.`,
      servers: serverList,
      recursion_desired: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Forwarder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Forwarding Zone</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Zone Name</Label>
            <Input
              placeholder="internal.example.com."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Forwarder Servers (comma-separated IPs)</Label>
            <Input
              placeholder="192.168.1.1, 192.168.1.2"
              value={servers}
              onChange={(e) => setServers(e.target.value)}
              required
            />
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

export default function ForwardersPage() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const utils = trpc.useUtils();
  const { state: confirmState, confirm, setOpen: setConfirmOpen } = useConfirm();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = trpc.recursor.forwarders.list.useQuery(
    { page, limit: 20, search: debouncedSearch || undefined },
    { retry: false }
  );

  const deleteMutation = trpc.recursor.forwarders.delete.useMutation({
    onSuccess: () => utils.recursor.forwarders.list.invalidate(),
  });

  const forwarders: ForwardZone[] = (data?.items as ForwardZone[]) ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const handleDelete = (zoneId: string, name: string) => {
    confirm({
      title: 'Delete Forwarder',
      description: `Are you sure you want to delete forwarder "${name}"?`,
      onConfirm: () => deleteMutation.mutate({ zoneId }),
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
        <h1 className="text-3xl font-bold">Forwarding Zones</h1>
        {!error && isAdmin && <AddForwarderDialog onSuccess={() => utils.recursor.forwarders.list.invalidate()} />}
      </div>

      {error && (
        <ServerUnavailable
          server="PowerDNS Recursor"
          message={error.message}
          envVars={['RECURSOR_URL', 'RECURSOR_API_KEY']}
        />
      )}

      {!error && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Configured Forwarders ({total})</CardTitle>
              <Input
                placeholder="Search forwarders…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Servers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forwarders.map((fz) => (
                      <TableRow key={fz.id}>
                        <TableCell className="font-mono font-medium">{fz.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{fz.kind}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {fz.servers?.join(', ') ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <div className="flex items-center justify-end gap-1">
                              <EditForwarderDialog
                                zone={fz}
                                onSuccess={() => utils.recursor.forwarders.list.invalidate()}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete forwarder ${fz.name}`}
                                onClick={() => handleDelete(fz.id, fz.name)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {forwarders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No forwarders configured
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
