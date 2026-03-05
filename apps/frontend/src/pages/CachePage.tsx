import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ServerUnavailable } from '@/components/ui/server-unavailable';
import { CheckCircle2 } from 'lucide-react';

function FlushCard({
  title,
  description,
  placeholder,
  onFlush,
  isPending,
  result,
  error,
}: {
  title: string;
  description: string;
  placeholder: string;
  onFlush: (value?: string) => void;
  isPending: boolean;
  result: string | null;
  error: string | null;
}) {
  const [value, setValue] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Domain (leave blank to flush all)</Label>
          <Input
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button
          variant="destructive"
          disabled={isPending}
          onClick={() => onFlush(value || undefined)}
        >
          {isPending ? 'Flushing…' : 'Flush Cache'}
        </Button>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {result && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Cache flushed successfully. {result}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function RecursorFlushCard({
  onFlush,
  isPending,
  result,
  error,
}: {
  onFlush: (name?: string, subtree?: boolean) => void;
  isPending: boolean;
  result: string | null;
  error: string | null;
}) {
  const [value, setValue] = useState('');
  const [subtree, setSubtree] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recursor Cache</CardTitle>
        <CardDescription>Flush the PowerDNS recursor resolver cache</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Domain (leave blank to flush all)</Label>
          <Input
            placeholder="example.com."
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="subtree"
            checked={subtree}
            onCheckedChange={(checked) => setSubtree(checked === true)}
          />
          <Label htmlFor="subtree" className="text-sm font-normal cursor-pointer">
            Flush entire subtree (all names under this domain)
          </Label>
        </div>
        <Button
          variant="destructive"
          disabled={isPending}
          onClick={() => onFlush(value || undefined, subtree || undefined)}
        >
          {isPending ? 'Flushing…' : 'Flush Cache'}
        </Button>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {result && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Cache flushed successfully. {result}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default function CachePage() {
  const [pdnsResult, setPdnsResult] = useState<string | null>(null);
  const [recursorResult, setRecursorResult] = useState<string | null>(null);
  const [pdnsError, setPdnsError] = useState<string | null>(null);
  const [recursorError, setRecursorError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdnsResult) return;
    const t = setTimeout(() => setPdnsResult(null), 3000);
    return () => clearTimeout(t);
  }, [pdnsResult]);

  useEffect(() => {
    if (!recursorResult) return;
    const t = setTimeout(() => setRecursorResult(null), 3000);
    return () => clearTimeout(t);
  }, [recursorResult]);

  // Probe connectivity on mount
  const pdnsInfo = trpc.pdns.server.info.useQuery(undefined, { retry: false });
  const recursorStats = trpc.recursor.cache.stats.useQuery(undefined, { retry: false });

  const pdnsFlush = trpc.pdns.cache.flush.useMutation({
    onSuccess: (data) => {
      const d = data as Record<string, unknown>;
      setPdnsResult(d?.count != null ? `${d.count} entries removed.` : '');
      setPdnsError(null);
    },
    onError: (e) => { setPdnsError(e.message); setPdnsResult(null); },
  });

  const recursorFlush = trpc.recursor.cache.flush.useMutation({
    onSuccess: (data) => {
      const d = data as Record<string, unknown>;
      setRecursorResult(d?.count != null ? `${d.count} entries removed.` : '');
      setRecursorError(null);
    },
    onError: (e) => { setRecursorError(e.message); setRecursorResult(null); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Cache Management</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {pdnsInfo.error ? (
            <ServerUnavailable
              server="PowerDNS Auth Server"
              message={pdnsInfo.error.message}
              envVars={['PDNS_URL', 'PDNS_API_KEY']}
            />
          ) : (
            <FlushCard
              title="Auth Server Cache"
              description="Flush the PowerDNS authoritative server packet cache"
              placeholder="example.com."
              onFlush={(domain) => pdnsFlush.mutate({ domain })}
              isPending={pdnsFlush.isPending}
              result={pdnsResult}
              error={pdnsError}
            />
          )}
        </div>

        <div className="space-y-4">
          {recursorStats.error ? (
            <ServerUnavailable
              server="PowerDNS Recursor"
              message={recursorStats.error.message}
              envVars={['RECURSOR_URL', 'RECURSOR_API_KEY']}
            />
          ) : (
            <RecursorFlushCard
              onFlush={(name, subtree) => recursorFlush.mutate({ name, subtree })}
              isPending={recursorFlush.isPending}
              result={recursorResult}
              error={recursorError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
