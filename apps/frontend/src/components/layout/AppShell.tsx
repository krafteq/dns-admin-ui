import { Sidebar } from './Sidebar';
import { NetworkBackground } from './NetworkBackground';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="relative flex-1 overflow-auto">
        <NetworkBackground />
        <div className="relative z-10 p-6">{children}</div>
      </main>
    </div>
  );
}
