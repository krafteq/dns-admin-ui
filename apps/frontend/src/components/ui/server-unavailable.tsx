import { ServerOff } from 'lucide-react';
import { Card, CardContent } from './card';

interface ServerUnavailableProps {
  server: string;
  message: string;
  envVars?: string[];
}

export function ServerUnavailable({ server, message, envVars }: ServerUnavailableProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-start gap-3 py-5 text-muted-foreground">
        <ServerOff className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-medium text-foreground">{server} not connected</div>
          <div className="text-sm">{message}</div>
          {envVars && (
            <div className="text-xs pt-1">
              Set{' '}
              {envVars.map((v, i) => (
                <span key={v}>
                  <code className="bg-muted px-1 rounded">{v}</code>
                  {i < envVars.length - 1 ? ' and ' : ''}
                </span>
              ))}{' '}
              in <code className="bg-muted px-1 rounded">apps/backend/.env</code>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
