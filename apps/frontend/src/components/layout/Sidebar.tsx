import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Globe,
  RefreshCw,
  Database,
  ArrowRightLeft,
  FileText,
  LogOut,
  Users,
  Search,
  Key,
  Server,
  Settings,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const navGroups: { label?: string; items: { to: string; label: string; icon: React.ComponentType<any>; end?: boolean }[] }[] = [
  {
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Auth Server',
    items: [
      { to: '/search', label: 'Search', icon: Search },
      { to: '/zones', label: 'Zones', icon: Globe },
      { to: '/tsigkeys', label: 'TSIG Keys', icon: Key },
      { to: '/autoprimaries', label: 'Autoprimaries', icon: Server },
    ],
  },
  {
    label: 'Recursor',
    items: [
      { to: '/recursor', label: 'Statistics', icon: RefreshCw, end: true },
      { to: '/forwarders', label: 'Forwarders', icon: ArrowRightLeft },
      { to: '/recursor/config', label: 'Configuration', icon: Settings },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/cache', label: 'Cache', icon: Database },
      { to: '/audit', label: 'Audit Log', icon: FileText },
      { to: '/users', label: 'Users', icon: Users },
    ],
  },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex items-center gap-1 rounded-md border p-1">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            'flex-1 rounded-sm p-1.5 transition-colors',
            theme === value
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="mx-auto h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-card">
      <div className="flex h-16 items-center px-6">
        <span className="text-lg font-bold tracking-tight">DNS Admin</span>
      </div>
      <Separator />
      <nav className="flex-1 p-3 space-y-4">
        {navGroups.map((group, i) => (
          <div key={i}>
            {group.label && (
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <Separator />
      <div className="p-3 space-y-2">
        <ThemeToggle />
        <div className="px-3 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>Logged in as <span className="font-medium">{user?.username}</span></span>
          <Badge variant="outline" className="text-xs">{user?.role}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => void logout()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
