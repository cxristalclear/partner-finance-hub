import { Landmark, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function DashboardNav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border/50">
      <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Landmark className="w-4 h-4 text-primary" />
        </div>
        <span className="font-semibold text-lg tracking-tight">Vault</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {user?.email}
        </span>
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </nav>
  );
}
