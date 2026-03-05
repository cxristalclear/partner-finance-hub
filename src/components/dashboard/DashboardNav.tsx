import { Landmark, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function DashboardNav() {
  const { user, signOut } = useAuth();

  return (
    <nav className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border/50">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Landmark className="w-4 h-4 text-primary" />
        </div>
        <span className="font-semibold text-lg tracking-tight">Vault</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {user?.email}
        </span>
        <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </nav>
  );
}
