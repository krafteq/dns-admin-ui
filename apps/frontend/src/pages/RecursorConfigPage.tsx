import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ServerUnavailable } from '@/components/ui/server-unavailable';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X } from 'lucide-react';

type ConfigItem = { name: string; type: string; value: unknown };

function AllowFromSection() {
  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.recursor.config.getAllowFrom.useQuery(undefined, { retry: false });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [newEntry, setNewEntry] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const setMutation = trpc.recursor.config.setAllowFrom.useMutation({
    onSuccess: () => {
      utils.recursor.config.getAllowFrom.invalidate();
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (e) => setSaveError(e.message),
  });

  const allowFrom = data as { value?: string[] } | undefined;
  const entries: string[] = allowFrom?.value ?? [];

  const startEdit = () => {
    setDraft(entries.join('\n'));
    setNewEntry('');
    setSaveError(null);
    setEditing(true);
  };

  const handleSave = () => {
    setSaveError(null);
    const lines = draft
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    setMutation.mutate({ value: lines });
  };

  const addEntry = () => {
    const trimmed = newEntry.trim();
    if (!trimmed) return;
    setDraft((d) => (d ? `${d}\n${trimmed}` : trimmed));
    setNewEntry('');
  };

  if (error) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Allow-From ACL</CardTitle>
          {isAdmin && !editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {saveSuccess && (
          <Alert>
            <AlertDescription>Allow-from updated successfully.</AlertDescription>
          </Alert>
        )}
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : editing ? (
          <div className="space-y-3">
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                One CIDR or IP per line
              </Label>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="font-mono text-sm min-h-[120px]"
                placeholder="0.0.0.0/0&#10;127.0.0.1"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add entry (e.g. 10.0.0.0/8)"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEntry())}
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={addEntry} type="button">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={setMutation.isPending}>
                {setMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {entries.length === 0 ? (
              <span className="text-muted-foreground text-sm">No entries configured</span>
            ) : (
              entries.map((e) => (
                <Badge key={e} variant="secondary" className="font-mono">
                  {e}
                </Badge>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AllowNotifyFromSection() {
  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.recursor.config.getAllowNotifyFrom.useQuery(undefined, { retry: false });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [newEntry, setNewEntry] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const setMutation = trpc.recursor.config.setAllowNotifyFrom.useMutation({
    onSuccess: () => {
      utils.recursor.config.getAllowNotifyFrom.invalidate();
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (e) => setSaveError(e.message),
  });

  const allowNotifyFrom = data as { value?: string[] } | undefined;
  const entries: string[] = allowNotifyFrom?.value ?? [];

  const startEdit = () => {
    setDraft(entries.join('\n'));
    setNewEntry('');
    setSaveError(null);
    setEditing(true);
  };

  const handleSave = () => {
    setSaveError(null);
    const lines = draft
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    setMutation.mutate({ value: lines });
  };

  const addEntry = () => {
    const trimmed = newEntry.trim();
    if (!trimmed) return;
    setDraft((d) => (d ? `${d}\n${trimmed}` : trimmed));
    setNewEntry('');
  };

  if (error) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Allow-Notify-From ACL</CardTitle>
          {isAdmin && !editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {saveSuccess && (
          <Alert>
            <AlertDescription>Allow-notify-from updated successfully.</AlertDescription>
          </Alert>
        )}
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : editing ? (
          <div className="space-y-3">
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                IPs/CIDRs allowed to send NOTIFY to this recursor (one per line)
              </Label>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="font-mono text-sm min-h-[120px]"
                placeholder="0.0.0.0/0&#10;127.0.0.1"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add entry (e.g. 10.0.0.0/8)"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEntry())}
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={addEntry} type="button">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={setMutation.isPending}>
                {setMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {entries.length === 0 ? (
              <span className="text-muted-foreground text-sm">No entries configured</span>
            ) : (
              entries.map((e) => (
                <Badge key={e} variant="secondary" className="font-mono">
                  {e}
                </Badge>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RecursorConfigPage() {
  const { data, isLoading, error } = trpc.recursor.config.list.useQuery(undefined, { retry: false });
  const serverInfo = trpc.recursor.serverInfo.useQuery(undefined, { retry: false });

  const items = (data as ConfigItem[]) ?? [];
  const info = serverInfo.data as { version?: string; daemon_type?: string } | undefined;

  const formatValue = (value: unknown): string => {
    if (Array.isArray(value)) return value.join(', ') || '—';
    if (value === null || value === undefined) return '—';
    return String(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Recursor Configuration</h1>
        {info && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{info.daemon_type ?? 'recursor'}</Badge>
            <span>v{info.version}</span>
          </div>
        )}
      </div>

      {error && (
        <ServerUnavailable
          server="PowerDNS Recursor"
          message={error.message}
          envVars={['RECURSOR_URL', 'RECURSOR_API_KEY']}
        />
      )}

      {!error && (
        <>
          <AllowFromSection />
          <AllowNotifyFromSection />

          <Card>
            <CardHeader>
              <CardTitle>All Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-muted-foreground">Loading…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell className="font-mono text-sm">{item.name}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{item.type}</span>
                        </TableCell>
                        <TableCell className="font-mono text-sm max-w-md truncate">
                          {formatValue(item.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No configuration data
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
