import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InvitePartnerDialog } from '@/components/dashboard/InvitePartnerDialog';
import { ArrowLeft, Landmark, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { CATEGORY_OPTIONS, defaultPlaidCategory, defaultManualCategory } from '@/lib/categories';

interface AccountRow {
  accountId: string;
  source: 'plaid' | 'manual';
  name: string;
  type: string;
  institution: string;
  balance: number;
  category: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const [balancesRes, connectionsRes, manualRes, catRes, profileRes] = await Promise.all([
        supabase.from('account_balances').select('*'),
        supabase.rpc('get_household_bank_connections'),
        supabase.from('manual_accounts').select('*'),
        supabase.from('account_categories').select('*'),
        supabase.from('profiles').select('household_id').eq('user_id', user?.id).single(),
      ]);

      const balances = balancesRes.data || [];
      const connections = (connectionsRes.data || []) as { id: string; institution_name: string }[];
      const manualAccts = manualRes.data || [];
      const categories = catRes.data || [];

      // Build connection id -> institution name map
      const connMap = new Map<string, string>();
      for (const c of connections) {
        connMap.set(c.id, c.institution_name);
      }

      const catMap = new Map<string, string>();
      for (const c of categories) {
        catMap.set(`${c.account_source}:${c.account_id}`, c.category);
      }

      const rows: AccountRow[] = [];

      for (const bal of balances) {
        const key = `plaid:${bal.account_id}`;
        rows.push({
          accountId: bal.account_id,
          source: 'plaid',
          name: bal.name,
          type: bal.subtype || bal.type,
          institution: connMap.get(bal.bank_connection_id) || 'Unknown',
          balance: Number(bal.current_balance),
          category: catMap.get(key) || defaultPlaidCategory(bal.type, bal.subtype),
        });
      }

      for (const acct of manualAccts) {
        const key = `manual:${acct.id}`;
        rows.push({
          accountId: acct.id,
          source: 'manual',
          name: acct.account_name,
          type: acct.account_type,
          institution: acct.institution_name,
          balance: Number(acct.balance),
          category: catMap.get(key) || defaultManualCategory(acct.account_type),
        });
      }

      setAccounts(rows);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = async (accountId: string, source: string, category: string) => {
    setSaving(accountId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('household_id').eq('user_id', user?.id).single();
      if (!profile?.household_id) throw new Error('No household');

      const { error } = await (supabase.from('account_categories' as any) as any).upsert(
        {
          household_id: profile.household_id,
          account_id: accountId,
          account_source: source,
          category,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'household_id,account_id,account_source' }
      );
      if (error) throw error;

      setAccounts((prev) =>
        prev.map((a) =>
          a.accountId === accountId && a.source === source ? { ...a, category } : a
        )
      );
      toast.success('Category updated');
    } catch {
      toast.error('Failed to update category');
    } finally {
      setSaving(null);
    }
  };

  // Group by institution
  const grouped = accounts.reduce<Record<string, AccountRow[]>>((acc, row) => {
    const key = `${row.institution}${row.source === 'manual' ? ' (manual)' : ''}`;
    (acc[key] ||= []).push(row);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-semibold">Account Settings</h1>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Household</h3>
          <InvitePartnerDialog />
        </div>

        <p className="text-sm text-muted-foreground">
          <strong>Net Worth</strong> and <strong>Investment</strong> accounts count toward your total.{' '}
          <strong>The Universe Is Handling This</strong> accounts are tracked on their own page.{' '}
          <strong>Exclude</strong> hides an account from everywhere.
        </p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No accounts to configure.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([instName, rows], idx) => (
              <motion.div
                key={instName}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="glass-card p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Landmark className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{instName}</h3>
                </div>

                <div className="space-y-3">
                  {rows.map((row) => (
                    <div key={`${row.source}-${row.accountId}`} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{row.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground shrink-0">
                          {row.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-mono">
                          ${row.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <Select
                          value={row.category}
                          onValueChange={(val) => handleCategoryChange(row.accountId, row.source, val)}
                          disabled={saving === row.accountId}
                        >
                          <SelectTrigger className="w-[200px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
