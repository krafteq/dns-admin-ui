import { useState } from 'react';
import { Key, Plus, Trash2, Pencil, Copy, Check } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirm } from '@/hooks/use-confirm';

const ALGORITHMS = [
  'hmac-md5',
  'hmac-sha1',
  'hmac-sha224',
  'hmac-sha256',
  'hmac-sha384',
  'hmac-sha512',
];

type TsigKey = {
  id?: string;
  name: string;
  algorithm: string;
  key?: string;
  type?: string;
};

function KeyValueCell({ value }: { value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted-foreground">—</span>;

  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs">{'•'.repeat(16)}</span>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copy} aria-label="Copy key">
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function CreateTsigKeyDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [algorithm, setAlgorithm] = useState('hmac-sha256');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.pdns.tsigkeys.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setName('');
      setKey('');
      setError(null);
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate({ name, algorithm, key: key || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add TSIG Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add TSIG Key</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Algorithm</Label>
            <Select value={algorithm} onValueChange={setAlgorithm}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALGORITHMS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Key <span className="text-muted-foreground text-xs">(optional — auto-generated if empty)</span></Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Base64-encoded secret"
              className="font-mono"
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

function EditTsigKeyDialog({ tsigKey, onSuccess }: { tsigKey: TsigKey; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [algorithm, setAlgorithm] = useState(tsigKey.algorithm);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const updateMutation = trpc.pdns.tsigkeys.update.useMutation({
    onSuccess: () => {
      setOpen(false);
      setKey('');
      setError(null);
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    updateMutation.mutate({ id: tsigKey.id!, algorithm, key: key || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (o) {
        setAlgorithm(tsigKey.algorithm);
        setKey('');
        setError(null);
      }
      setOpen(o);
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit TSIG key ${tsigKey.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit TSIG Key — <span className="font-mono">{tsigKey.name}</span></DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Algorithm</Label>
            <Select value={algorithm} onValueChange={setAlgorithm}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALGORITHMS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>New Key <span className="text-muted-foreground text-xs">(leave blank to keep existing)</span></Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Base64-encoded secret"
              className="font-mono"
            />
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

export default function TsigKeysPage() {
  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();
  const { state: confirmState, confirm, setOpen: setConfirmOpen } = useConfirm();

  const { data, isLoading, error } = trpc.pdns.tsigkeys.list.useQuery(undefined, { retry: false });

  const deleteMutation = trpc.pdns.tsigkeys.delete.useMutation({
    onSuccess: () => utils.pdns.tsigkeys.list.invalidate(),
  });

  const keys = (data as TsigKey[]) ?? [];

  const handleDelete = (id: string, name: string) => {
    confirm({
      title: 'Delete TSIG Key',
      description: `Are you sure you want to delete TSIG key "${name}"?`,
      onConfirm: () => deleteMutation.mutate({ id }),
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
          <h1 className="text-3xl font-bold">TSIG Keys</h1>
          <p className="text-muted-foreground mt-1">
            Transaction signatures for zone transfers and DNS updates
          </p>
        </div>
        {isAdmin && (
          <CreateTsigKeyDialog onSuccess={() => utils.pdns.tsigkeys.list.invalidate()} />
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
            <Key className="h-4 w-4" />
            Keys ({keys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Algorithm</TableHead>
                  <TableHead>Key</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id ?? k.name}>
                    <TableCell className="font-mono">{k.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{k.algorithm}</Badge>
                    </TableCell>
                    <TableCell>
                      <KeyValueCell value={k.key} />
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <EditTsigKeyDialog
                            tsigKey={k}
                            onSuccess={() => utils.pdns.tsigkeys.list.invalidate()}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete TSIG key ${k.name}`}
                            onClick={() => handleDelete(k.id!, k.name)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {keys.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 4 : 3}
                      className="text-center text-muted-foreground"
                    >
                      No TSIG keys configured
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
