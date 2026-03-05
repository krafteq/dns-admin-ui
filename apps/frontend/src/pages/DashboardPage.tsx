import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServerOff, RefreshCw } from 'lucide-react';

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function UnavailableCard({ label, detail }: { label: string; detail: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center gap-3 py-5 text-muted-foreground">
        <ServerOff className="h-5 w-5 shrink-0" />
        <div>
          <div className="font-medium">{label} not connected</div>
          <div className="text-xs mt-0.5 break-all">{detail}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatUpdatedAt(ts: number) {
  if (!ts) return null;
  const date = new Date(ts);
  return date.toLocaleTimeString();
}

function ServerInfoCard() {
  const { data, isLoading, error } = trpc.pdns.server.info.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-5 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Connecting to Auth Server…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <UnavailableCard label="PowerDNS Auth Server" detail={error.message} />;
  }

  const info = data as Record<string, string>;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">PowerDNS Auth Server</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div><span className="text-muted-foreground">Version: </span>{info?.version}</div>
        <div><span className="text-muted-foreground">Daemon: </span>{info?.daemon_type}</div>
        <div><span className="text-muted-foreground">ID: </span>{info?.id}</div>
      </CardContent>
    </Card>
  );
}

function RecursorStatusCard() {
  const { data, isLoading, error } = trpc.recursor.stats.useQuery(undefined, {
    retry: false,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-5 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Connecting to Recursor…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <UnavailableCard label="PowerDNS Recursor" detail={error.message} />;
  }

  const stats = (data as Array<{ name: string; value: string | number }>) ?? [];
  const uptime = stats.find((s) => s.name === 'uptime')?.value;
  const questions = stats.find((s) => s.name === 'questions')?.value;
  const cacheHits = stats.find((s) => s.name === 'cache-hits')?.value;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">PowerDNS Recursor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {uptime !== undefined && (
          <div><span className="text-muted-foreground">Uptime: </span>{uptime}s</div>
        )}
        {questions !== undefined && (
          <div><span className="text-muted-foreground">Questions: </span>{questions}</div>
        )}
        {cacheHits !== undefined && (
          <div><span className="text-muted-foreground">Cache hits: </span>{cacheHits}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ServerInfoCard />
        <RecursorStatusCard />
      </div>

      <PdnsStatSection />
      <RecursorStatSection />
    </div>
  );
}

function PdnsStatSection() {
  const { data, error, isFetching, dataUpdatedAt } = trpc.pdns.server.stats.useQuery(undefined, {
    retry: false,
    refetchInterval: 10000,
  });
  if (error || !data) return null;

  const stats = (data as Array<{ name: string; value: string | number }>) ?? [];
  const interesting = ['udp-queries', 'tcp-queries', 'cache-hits', 'cache-misses', 'servfail-answers'];
  const filtered = stats.filter((s) => interesting.includes(s.name));
  if (filtered.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Auth Server Stats</h2>
        {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        {dataUpdatedAt > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            Updated at {formatUpdatedAt(dataUpdatedAt)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {filtered.map((s) => (
          <StatCard key={s.name} title={s.name} value={s.value} />
        ))}
      </div>
    </>
  );
}

function RecursorStatSection() {
  const { data, error, isFetching, dataUpdatedAt } = trpc.recursor.stats.useQuery(undefined, {
    retry: false,
    refetchInterval: 10000,
  });
  if (error || !data) return null;

  const stats = (data as Array<{ name: string; value: string | number }>) ?? [];
  const interesting = ['all-outqueries', 'cache-hits', 'cache-misses', 'packetcache-hits', 'packetcache-misses', 'concurrent-queries', 'servfail-answers'];
  const filtered = stats.filter((s) => interesting.includes(s.name));
  if (filtered.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Recursor Stats</h2>
        {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        {dataUpdatedAt > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            Updated at {formatUpdatedAt(dataUpdatedAt)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {filtered.map((s) => (
          <StatCard key={`r-${s.name}`} title={`[R] ${s.name}`} value={s.value} />
        ))}
      </div>
    </>
  );
}
