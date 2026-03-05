import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ENTITY_TYPES = ['zone', 'record', 'forwarder', 'cache'];

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

const actionColors: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  CREATE_ZONE: 'default',
  DELETE_ZONE: 'destructive',
  UPDATE_ZONE: 'secondary',
  PATCH_RECORDS: 'secondary',
  CREATE_FORWARDER: 'default',
  DELETE_FORWARDER: 'destructive',
  FLUSH_CACHE: 'outline',
  FLUSH_RECURSOR_CACHE: 'outline',
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>('');

  const { data, isLoading, error } = trpc.audit.list.useQuery({
    page,
    limit: 20,
    entityType: entityType || undefined,
  });

  const entries = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Audit Log</h1>

      <div className="flex items-center gap-4">
        <div className="w-48">
          <Select
            value={entityType || 'all'}
            onValueChange={(v) => {
              setEntityType(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} total entries
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{entry.username}</TableCell>
                    <TableCell>
                      <Badge variant={actionColors[entry.action] ?? 'secondary'}>
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.entityType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.entityId ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No entries found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

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
        </CardContent>
      </Card>
    </div>
  );
}
