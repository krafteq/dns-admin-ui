import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, Key, Bell, Download, RotateCcw, Copy, Check, Eye } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirm } from '@/hooks/use-confirm';

const RECORD_TYPES: { type: string; hint: string }[] = [
  { type: 'A',     hint: 'IPv4 address — maps a name to 192.168.1.10' },
  { type: 'AAAA',  hint: 'IPv6 address — maps a name to fd00::1' },
  { type: 'CNAME', hint: 'Alias — points a name to another name' },
  { type: 'MX',    hint: 'Mail server — e.g. 10 mail.example.com.' },
  { type: 'TXT',   hint: 'Text data — SPF, DKIM, domain verification' },
  { type: 'NS',    hint: 'Nameserver — delegates a zone to another server' },
  { type: 'PTR',   hint: 'Reverse DNS — maps an IP back to a name' },
  { type: 'SRV',   hint: 'Service location — priority weight port target' },
  { type: 'CAA',   hint: 'Certificate authority — controls TLS cert issuance' },
  { type: 'SOA',   hint: 'Zone authority — auto-created, rarely edited manually' },
];

type RRSet = {
  name: string;
  type: string;
  ttl: number;
  records: Array<{ content: string; disabled: boolean }>;
};

type Zone = {
  id: string;
  name: string;
  kind: string;
  serial: number;
  dnssec: boolean;
  rrsets: RRSet[];
};

type CryptoKey = {
  id: number;
  type: string;
  active: boolean;
  algorithm?: string;
  bits?: number;
  ds?: string[];
  dnskey?: string;
  flags?: number;
};

function AddRecordDialog({ zoneId, zoneName, onSuccess }: { zoneId: string; zoneName: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('A');
  const [ttl, setTtl] = useState('300');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const patchMutation = trpc.pdns.records.patch.useMutation({
    onSuccess: () => {
      setOpen(false);
      setName('');
      setContent('');
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // If user typed a relative name (e.g. "blog"), append the zone name
    let recordName = name ? name : zoneName;
    if (name && !name.endsWith('.')) {
      recordName = `${name}.${zoneName}`;
    }
    patchMutation.mutate({
      zoneId,
      rrsets: [
        {
          name: recordName.endsWith('.') ? recordName : `${recordName}.`,
          type,
          ttl: parseInt(ttl, 10) || 3600,
          changetype: 'REPLACE',
          records: [{ content, disabled: false }],
        },
      ],
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Record
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Name (leave blank for apex)</Label>
            <Input placeholder={zoneName} value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">Relative to zone — e.g. type <code>www</code>, not <code>www.{zoneName}</code></p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map(({ type: t, hint }) => (
                    <SelectItem key={t} value={t} title={hint}>
                      <span className="font-mono font-medium">{t}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>TTL</Label>
              <Input type="number" min={0} value={ttl} onChange={(e) => setTtl(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <Input value={content} onChange={(e) => setContent(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={patchMutation.isPending}>
              {patchMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditRRSetDialog({ zoneId, rrset, onSuccess }: { zoneId: string; rrset: RRSet; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [ttl, setTtl] = useState(String(rrset.ttl));
  const [records, setRecords] = useState<string[]>(rrset.records.map((r) => r.content));
  const [error, setError] = useState<string | null>(null);

  const patchMutation = trpc.pdns.records.patch.useMutation({
    onSuccess: () => {
      setOpen(false);
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    patchMutation.mutate({
      zoneId,
      rrsets: [
        {
          name: rrset.name,
          type: rrset.type,
          ttl: parseInt(ttl, 10),
          changetype: 'REPLACE',
          records: records.filter(Boolean).map((c) => ({ content: c, disabled: false })),
        },
      ],
    });
  };

  const addRecord = () => setRecords((r) => [...r, '']);
  const removeRecord = (i: number) => setRecords((r) => r.filter((_, idx) => idx !== i));
  const updateRecord = (i: number, val: string) =>
    setRecords((r) => r.map((v, idx) => (idx === i ? val : v)));

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (o) {
        setTtl(String(rrset.ttl));
        setRecords(rrset.records.map((r) => r.content));
        setError(null);
      }
      setOpen(o);
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${rrset.type} records for ${rrset.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Edit {rrset.type} — <span className="font-mono">{rrset.name}</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>TTL</Label>
            <Input type="number" min={0} value={ttl} onChange={(e) => setTtl(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Records</Label>
            <div className="space-y-2">
              {records.map((rec, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={rec}
                    onChange={(e) => updateRecord(i, e.target.value)}
                    placeholder="Record content"
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove record"
                    onClick={() => removeRecord(i)}
                    disabled={records.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRecord}>
              <Plus className="mr-1 h-3 w-3" /> Add Record
            </Button>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={patchMutation.isPending}>
              {patchMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExportZoneDialog({ zoneId }: { zoneId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportQuery = trpc.pdns.zones.export.useQuery(
    { zoneId },
    { enabled: open, retry: false }
  );

  const copyContent = () => {
    if (exportQuery.data?.content) {
      void navigator.clipboard.writeText(exportQuery.data.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Zone</DialogTitle>
          <DialogDescription>Zone file in BIND format</DialogDescription>
        </DialogHeader>
        {exportQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {exportQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{exportQuery.error.message}</AlertDescription>
          </Alert>
        )}
        {exportQuery.data && (
          <div className="space-y-2">
            <pre className="bg-muted rounded p-4 text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">
              {exportQuery.data.content}
            </pre>
            <Button variant="outline" size="sm" onClick={copyContent}>
              {copied ? (
                <><Check className="mr-2 h-4 w-4" /> Copied</>
              ) : (
                <><Copy className="mr-2 h-4 w-4" /> Copy</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ZoneMetadataItem = { kind: string; metadata: string[] };

function AddMetadataDialog({ zoneId, onSuccess }: { zoneId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('');
  const [values, setValues] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.pdns.metadata.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setKind('');
      setValues('');
      setError(null);
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const metadata = values.split('\n').map((v) => v.trim()).filter(Boolean);
    createMutation.mutate({ zoneId, kind, metadata });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Add Metadata
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Zone Metadata</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Kind</Label>
            <Input
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              placeholder="ALLOW-AXFR-FROM"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Values <span className="text-muted-foreground text-xs">(one per line)</span></Label>
            <Textarea
              value={values}
              onChange={(e) => setValues(e.target.value)}
              placeholder={'AUTO\n192.168.0.0/24'}
              rows={4}
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

function ZoneMetadataSection({ zoneId }: { zoneId: string }) {
  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();
  const { state: confirmState, confirm, setOpen: setConfirmOpen } = useConfirm();

  const metadataQuery = trpc.pdns.metadata.list.useQuery({ zoneId }, { retry: false });

  const deleteMutation = trpc.pdns.metadata.delete.useMutation({
    onSuccess: () => utils.pdns.metadata.list.invalidate({ zoneId }),
  });

  const items = (metadataQuery.data as ZoneMetadataItem[]) ?? [];

  const handleDelete = (kind: string) => {
    confirm({
      title: 'Delete Metadata',
      description: `Are you sure you want to delete metadata "${kind}"?`,
      onConfirm: () => deleteMutation.mutate({ zoneId, kind }),
    });
  };

  return (
    <Card>
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={setConfirmOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Delete"
        onConfirm={confirmState.onConfirm}
        isPending={deleteMutation.isPending}
      />
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Zone Metadata</CardTitle>
          {isAdmin && (
            <AddMetadataDialog
              zoneId={zoneId}
              onSuccess={() => utils.pdns.metadata.list.invalidate({ zoneId })}
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {metadataQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{metadataQuery.error.message}</AlertDescription>
          </Alert>
        )}
        {items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Values</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.kind}>
                  <TableCell className="font-mono font-medium">{item.kind}</TableCell>
                  <TableCell className="font-mono text-sm">{item.metadata.join(', ')}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete metadata ${item.kind}`}
                        onClick={() => handleDelete(item.kind)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : !metadataQuery.isError && (
          <p className="text-sm text-muted-foreground">No metadata configured.</p>
        )}
      </CardContent>
    </Card>
  );
}

function KeyDetailDialog({ zoneId, keyId }: { zoneId: string; keyId: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const keyQuery = trpc.pdns.dnssec.getKey.useQuery(
    { zoneId, keyId },
    { enabled: open, retry: false }
  );

  const keyData = keyQuery.data as CryptoKey & { privatekey?: string } | undefined;

  const copyText = (text: string, field: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`View key ${keyId} details`}>
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>DNSSEC Key #{keyId}</DialogTitle>
          <DialogDescription>Full key material including DNSKEY record and private key</DialogDescription>
        </DialogHeader>
        {keyQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {keyQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{keyQuery.error.message}</AlertDescription>
          </Alert>
        )}
        {keyData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>{' '}
                <Badge variant="outline">{keyData.type?.toUpperCase()}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Algorithm:</span>{' '}
                <span className="font-mono">{keyData.algorithm ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Bits:</span>{' '}
                <span className="font-mono">{keyData.bits ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Flags:</span>{' '}
                <span className="font-mono">{keyData.flags ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{' '}
                {keyData.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
              </div>
            </div>

            {keyData.dnskey && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">DNSKEY Record</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyText(keyData.dnskey!, 'dnskey')}
                  >
                    {copied === 'dnskey' ? <><Check className="mr-1 h-3 w-3" /> Copied</> : <><Copy className="mr-1 h-3 w-3" /> Copy</>}
                  </Button>
                </div>
                <pre className="bg-muted rounded p-3 text-xs font-mono overflow-auto max-h-24 whitespace-pre-wrap break-all">
                  {keyData.dnskey}
                </pre>
              </div>
            )}

            {keyData.ds && keyData.ds.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">DS Records</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyText(keyData.ds!.join('\n'), 'ds')}
                  >
                    {copied === 'ds' ? <><Check className="mr-1 h-3 w-3" /> Copied</> : <><Copy className="mr-1 h-3 w-3" /> Copy</>}
                  </Button>
                </div>
                <pre className="bg-muted rounded p-3 text-xs font-mono overflow-auto max-h-32 whitespace-pre-wrap break-all">
                  {keyData.ds.join('\n')}
                </pre>
              </div>
            )}

            {keyData.privatekey && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Private Key</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyText(keyData.privatekey!, 'privatekey')}
                  >
                    {copied === 'privatekey' ? <><Check className="mr-1 h-3 w-3" /> Copied</> : <><Copy className="mr-1 h-3 w-3" /> Copy</>}
                  </Button>
                </div>
                <pre className="bg-muted rounded p-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap break-all">
                  {keyData.privatekey}
                </pre>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DNSSECSection({ zoneId, zone }: { zoneId: string; zone: Zone }) {
  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();

  const keysQuery = trpc.pdns.dnssec.listKeys.useQuery(
    { zoneId },
    { retry: false }
  );

  const enableMutation = trpc.pdns.dnssec.enable.useMutation({
    onSuccess: () => {
      utils.pdns.dnssec.listKeys.invalidate({ zoneId });
      utils.pdns.zones.get.invalidate({ zoneId });
    },
  });

  const disableMutation = trpc.pdns.dnssec.disable.useMutation({
    onSuccess: () => {
      utils.pdns.dnssec.listKeys.invalidate({ zoneId });
      utils.pdns.zones.get.invalidate({ zoneId });
    },
  });

  const toggleMutation = trpc.pdns.dnssec.toggleKey.useMutation({
    onSuccess: () => {
      utils.pdns.dnssec.listKeys.invalidate({ zoneId });
    },
  });

  const keys = (keysQuery.data as CryptoKey[]) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            DNSSEC
            {zone.dnssec ? (
              <Badge>Enabled</Badge>
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
          </CardTitle>
          {isAdmin && (
            zone.dnssec ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={disableMutation.isPending}>
                    {disableMutation.isPending ? 'Disabling…' : 'Disable DNSSEC'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Disable DNSSEC</DialogTitle>
                    <DialogDescription>
                      All crypto keys for this zone will be permanently deleted. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        variant="destructive"
                        onClick={() => disableMutation.mutate({ zoneId })}
                      >
                        Disable DNSSEC
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Button
                size="sm"
                disabled={enableMutation.isPending}
                onClick={() => enableMutation.mutate({ zoneId })}
              >
                {enableMutation.isPending ? 'Enabling…' : 'Enable DNSSEC'}
              </Button>
            )
          )}
        </div>
      </CardHeader>
      <CardContent>
        {keysQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{keysQuery.error.message}</AlertDescription>
          </Alert>
        )}
        {keys.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Algorithm</TableHead>
                <TableHead>Bits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>DS Records</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>{key.id}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{key.type.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>{key.algorithm ?? '—'}</TableCell>
                  <TableCell>{key.bits ?? '—'}</TableCell>
                  <TableCell>
                    {key.active ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-xs truncate">
                    {key.ds?.join(', ') ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <KeyDetailDialog zoneId={zoneId} keyId={key.id} />
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={toggleMutation.isPending}
                          onClick={() =>
                            toggleMutation.mutate({ zoneId, keyId: key.id, active: !key.active })
                          }
                        >
                          {key.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {keys.length === 0 && !keysQuery.isError && (
          <p className="text-sm text-muted-foreground">No crypto keys configured.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ZoneDetailPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();
  const { state: confirmState, confirm, setOpen: setConfirmOpen } = useConfirm();
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data, isLoading, error } = trpc.pdns.zones.get.useQuery(
    { zoneId: zoneId! },
    { enabled: !!zoneId, retry: false }
  );

  const patchMutation = trpc.pdns.records.patch.useMutation({
    onSuccess: () => utils.pdns.zones.get.invalidate({ zoneId: zoneId! }),
  });

  const rectifyMutation = trpc.pdns.zones.rectify.useMutation({
    onSuccess: () => {
      setActionResult({ type: 'success', message: 'Zone rectified successfully.' });
      utils.pdns.zones.get.invalidate({ zoneId: zoneId! });
    },
    onError: (e) => setActionResult({ type: 'error', message: e.message }),
  });
  const axfrMutation = trpc.pdns.zones.axfrRetrieve.useMutation({
    onSuccess: () => {
      setActionResult({ type: 'success', message: 'AXFR retrieve initiated.' });
      utils.pdns.zones.get.invalidate({ zoneId: zoneId! });
    },
    onError: (e) => setActionResult({ type: 'error', message: e.message }),
  });
  const notifyMutation = trpc.pdns.zones.notify.useMutation({
    onSuccess: () => {
      setActionResult({ type: 'success', message: 'Notify sent to slaves.' });
      utils.pdns.zones.get.invalidate({ zoneId: zoneId! });
    },
    onError: (e) => setActionResult({ type: 'error', message: e.message }),
  });

  const zone = data as Zone | undefined;
  const rrsets = zone?.rrsets ?? [];

  const handleDeleteRRSet = (name: string, type: string) => {
    confirm({
      title: 'Delete Records',
      description: `Are you sure you want to delete all ${type} records for ${name}?`,
      onConfirm: () => patchMutation.mutate({
        zoneId: zoneId!,
        rrsets: [{ name, type, changetype: 'DELETE' }],
      }),
    });
  };

  if (isLoading) return <div className="text-muted-foreground">Loading zone…</div>;
  if (error)
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/zones"><ArrowLeft className="mr-2 h-4 w-4" />Back to Zones</Link>
        </Button>
        <ServerUnavailable
          server="PowerDNS Auth Server"
          message={error.message}
          envVars={['PDNS_URL', 'PDNS_API_KEY']}
        />
      </div>
    );

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={setConfirmOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Delete"
        onConfirm={confirmState.onConfirm}
      />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to zones">
          <Link to="/zones">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-mono">{zone?.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{zone?.kind}</Badge>
            {zone?.dnssec && <Badge>DNSSEC</Badge>}
            <span className="text-sm text-muted-foreground">Serial: {zone?.serial}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isAdmin && zone && ['Slave', 'Consumer'].includes(zone.kind) && (
            <Button
              variant="outline"
              size="sm"
              disabled={axfrMutation.isPending}
              onClick={() => axfrMutation.mutate({ zoneId: zoneId! })}
            >
              <Download className="mr-2 h-4 w-4" />
              {axfrMutation.isPending ? 'Retrieving…' : 'AXFR Retrieve'}
            </Button>
          )}
          {isAdmin && zone && ['Master', 'Producer'].includes(zone.kind) && (
            <Button
              variant="outline"
              size="sm"
              disabled={notifyMutation.isPending}
              onClick={() => notifyMutation.mutate({ zoneId: zoneId! })}
            >
              <Bell className="mr-2 h-4 w-4" />
              {notifyMutation.isPending ? 'Notifying…' : 'Notify'}
            </Button>
          )}
          {zone && <ExportZoneDialog zoneId={zoneId!} />}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              disabled={rectifyMutation.isPending}
              onClick={() => rectifyMutation.mutate({ zoneId: zoneId! })}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {rectifyMutation.isPending ? 'Rectifying…' : 'Rectify'}
            </Button>
          )}
          {isAdmin && (
            <AddRecordDialog
              zoneId={zoneId!}
              zoneName={zone?.name ?? ''}
              onSuccess={() => utils.pdns.zones.get.invalidate({ zoneId: zoneId! })}
            />
          )}
        </div>
      </div>

      {actionResult && (
        <Alert variant={actionResult.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{actionResult.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resource Records ({rrsets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>TTL</TableHead>
                <TableHead>Records</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rrsets.map((rr) => (
                <TableRow key={`${rr.name}-${rr.type}`}>
                  <TableCell className="font-mono text-sm">{rr.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{rr.type}</Badge>
                  </TableCell>
                  <TableCell>{rr.ttl}</TableCell>
                  <TableCell className="font-mono text-sm max-w-md">
                    {rr.records?.map((r, i) => (
                      <div key={i} className={r.disabled ? 'line-through text-muted-foreground' : ''}>
                        {r.content}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <div className="flex items-center justify-end gap-1">
                        <EditRRSetDialog
                          zoneId={zoneId!}
                          rrset={rr}
                          onSuccess={() => utils.pdns.zones.get.invalidate({ zoneId: zoneId! })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${rr.type} records for ${rr.name}`}
                          onClick={() => handleDeleteRRSet(rr.name, rr.type)}
                          disabled={patchMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rrsets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No records
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {zone && <DNSSECSection zoneId={zoneId!} zone={zone} />}
      {zone && <ZoneMetadataSection zoneId={zoneId!} />}
    </div>
  );
}
