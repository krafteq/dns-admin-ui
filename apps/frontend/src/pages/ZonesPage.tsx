import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ServerUnavailable } from '@/components/ui/server-unavailable';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirm } from '@/hooks/use-confirm';

type Zone = {
  id: string;
  name: string;
  kind?: string;
  serial?: number;
  dnssec?: boolean;
};

function CreateZoneDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'Native' | 'Master' | 'Slave'>('Native');
  const [nameservers, setNameservers] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.pdns.zones.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setName('');
      setKind('Native');
      setNameservers('');
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ns = nameservers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    createMutation.mutate({ name: name.endsWith('.') ? name : `${name}.`, kind, nameservers: ns });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Zone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Zone</DialogTitle>
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
              placeholder="example.com."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Native">Native</SelectItem>
                <SelectItem value="Master">Master</SelectItem>
                <SelectItem value="Slave">Slave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nameservers (comma-separated)</Label>
            <Input
              placeholder="ns1.example.com., ns2.example.com."
              value={nameservers}
              onChange={(e) => setNameservers(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ZonesPage() {
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

  const { data, isLoading, error } = trpc.pdns.zones.list.useQuery(
    { page, limit: 20, search: debouncedSearch || undefined },
    { retry: false }
  );

  const deleteMutation = trpc.pdns.zones.delete.useMutation({
    onSuccess: () => utils.pdns.zones.list.invalidate(),
  });

  const zones: Zone[] = (data?.items as Zone[]) ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const handleDelete = (zoneId: string, name: string) => {
    confirm({
      title: 'Delete Zone',
      description: `Are you sure you want to delete zone "${name}"? This action cannot be undone.`,
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
        <h1 className="text-3xl font-bold">Zones</h1>
        {!error && isAdmin && <CreateZoneDialog onSuccess={() => utils.pdns.zones.list.invalidate()} />}
      </div>

      {error && (
        <ServerUnavailable
          server="PowerDNS Auth Server"
          message={error.message}
          envVars={['PDNS_URL', 'PDNS_API_KEY']}
        />
      )}

      {!error && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Zones ({total})</CardTitle>
              <Input
                placeholder="Search zones…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground">Loading zones…</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead>DNSSEC</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zones.map((zone) => (
                      <TableRow key={zone.id}>
                        <TableCell className="font-mono font-medium">
                          <Link
                            to={`/zones/${encodeURIComponent(zone.id)}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {zone.name}
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{zone.kind}</Badge>
                        </TableCell>
                        <TableCell>{zone.serial ?? '—'}</TableCell>
                        <TableCell>
                          {zone.dnssec ? (
                            <Badge>DNSSEC</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete zone ${zone.name}`}
                              onClick={() => handleDelete(zone.id, zone.name)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {zones.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No zones found
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
