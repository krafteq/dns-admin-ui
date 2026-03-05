import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ServerOff, Shield } from 'lucide-react';

type MapEntry = { name: string; value: string };
type StatItem = { name: string; type: string; value: string | number | MapEntry[] };

function RpzStatsSection() {
  const { data, isLoading, error } = trpc.recursor.rpzStats.useQuery(undefined, { retry: false });

  // RPZ stats are returned as an array of objects or a single object with zone names as keys
  const rpzData = data as Array<Record<string, unknown>> | Record<string, unknown> | undefined;

  if (error) return null; // RPZ may not be configured — silently skip

  // Normalize: could be an array or object
  let entries: Array<{ zone: string; stats: Record<string, unknown> }> = [];
  if (rpzData) {
    if (Array.isArray(rpzData)) {
      entries = rpzData.map((item) => {
        const zone = (item.name as string) ?? 'unknown';
        return { zone, stats: item };
      });
    } else {
      entries = Object.entries(rpzData).map(([zone, stats]) => ({
        zone,
        stats: (typeof stats === 'object' && stats !== null ? stats : { value: stats }) as Record<string, unknown>,
      }));
    }
  }

  if (entries.length === 0 && !isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Response Policy Zones (RPZ)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No RPZ zones configured.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.zone}>
                  <TableCell className="font-mono text-sm">{entry.zone}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {Object.entries(entry.stats)
                        .filter(([k]) => k !== 'name')
                        .map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="font-mono text-xs">
                            {k}: {String(v)}
                          </Badge>
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function RecursorPage() {
  const { data, isLoading, error } = trpc.recursor.stats.useQuery(undefined, { retry: false });

  const stats = (data as StatItem[]) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Recursor Statistics</h1>

      {error && (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-5 text-muted-foreground">
            <ServerOff className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-foreground">Recursor not connected</div>
              <div className="text-sm mt-1">{error.message}</div>
              <div className="text-xs mt-2">Set <code className="bg-muted px-1 rounded">RECURSOR_URL</code> and <code className="bg-muted px-1 rounded">RECURSOR_API_KEY</code> in <code className="bg-muted px-1 rounded">apps/backend/.env</code></div>
            </div>
          </CardContent>
        </Card>
      )}

      {!error && (
        <>
          <RpzStatsSection />

          <Card>
            <CardHeader>
              <CardTitle>All Statistics</CardTitle>
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
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((s) => (
                      <TableRow key={s.name}>
                        <TableCell className="font-mono text-sm">{s.name}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{s.type}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Array.isArray(s.value)
                            ? s.value.map((e: MapEntry) => `${e.name}: ${e.value}`).join(', ')
                            : String(s.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {stats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No data
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
