import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type SearchResultItem = {
  object_type: string;
  name?: string;
  zone_id?: string;
  zone?: string;
  type?: string;
  content?: string;
};

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [objectType, setObjectType] = useState('all');
  const [submittedQ, setSubmittedQ] = useState('');
  const [submittedType, setSubmittedType] = useState('all');

  const searchQuery = trpc.pdns.search.search.useQuery(
    {
      q: submittedQ,
      objectType:
        submittedType === 'all'
          ? undefined
          : (submittedType as 'zone' | 'record' | 'comment'),
    },
    { enabled: submittedQ.length > 0, retry: false }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSubmittedQ(q.trim());
    setSubmittedType(objectType);
  };

  const results = (searchQuery.data as SearchResultItem[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search</h1>
        <p className="text-muted-foreground mt-1">
          Search zones, records, and comments in the Auth Server
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search query — e.g. example.com or 192.168"
          className="max-w-md"
        />
        <Select value={objectType} onValueChange={setObjectType}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="zone">Zones</SelectItem>
            <SelectItem value="record">Records</SelectItem>
            <SelectItem value="comment">Comments</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit">
          <Search className="mr-2 h-4 w-4" /> Search
        </Button>
      </form>

      {searchQuery.isError && (
        <Alert variant="destructive">
          <AlertDescription>{searchQuery.error.message}</AlertDescription>
        </Alert>
      )}

      {submittedQ && (
        <Card>
          <CardHeader>
            <CardTitle>
              Results ({results.length})
              {searchQuery.isFetching && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  Searching…
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Record Type</TableHead>
                  <TableHead>Content</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge
                        variant={
                          item.object_type === 'zone'
                            ? 'default'
                            : item.object_type === 'comment'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {item.object_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.name ?? '—'}</TableCell>
                    <TableCell>
                      {item.zone_id ? (
                        <Link
                          to={`/zones/${encodeURIComponent(item.zone_id)}`}
                          className="text-primary hover:underline font-mono text-sm"
                        >
                          {item.zone ?? item.zone_id}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.type ? (
                        <Badge variant="outline">{item.type}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-xs truncate">
                      {item.content ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {results.length === 0 && !searchQuery.isFetching && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No results found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
