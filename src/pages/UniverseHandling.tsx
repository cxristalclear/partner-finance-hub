import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { BankAccountCard } from '@/components/dashboard/BankAccountCard';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { defaultPlaidCategory, defaultManualCategory } from '@/lib/categories';

interface AccountData {
  account_id: string;
  name: string;
  type: string;
  subtype?: string;
  current_balance: number;
  is_hidden?: boolean;
  category?: string;
}

interface InstitutionData {
  institution: string;
  connection_id: string;
  accounts: AccountData[];
}

interface ManualAccount {
  id: string;
  institution_name: string;
  account_name: string;
  account_type: string;
  balance: number;
  is_hidden?: boolean;
  category?: string;
}

function dedupKey(institution: string, accountName: string): string {
  return `${institution.toLowerCase()}:${accountName.toLowerCase()}`;
}

function deduplicateInstitutions(institutions: InstitutionData[]): { deduped: InstitutionData[]; sharedKeys: Set<string> } {
  const counts = new Map<string, number>();
  const sharedKeys = new Set<string>();

  for (const inst of institutions) {
    for (const a of inst.accounts) {
      const key = dedupKey(inst.institution, a.name);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  for (const [key, count] of counts) {
    if (count > 1) sharedKeys.add(key);
  }

  const kept = new Set<string>();
  const deduped = institutions.map((inst) => ({
    ...inst,
    accounts: inst.accounts.filter((a) => {
      const key = dedupKey(inst.institution, a.name);
      if (kept.has(key)) return false;
      kept.add(key);
      return true;
    }),
  })).filter((inst) => inst.accounts.length > 0);

  return { deduped, sharedKeys };
}

function sumVisible(accounts: { current_balance?: number; balance?: number; is_hidden?: boolean }[]) {
  return accounts.filter((a) => !a.is_hidden).reduce((s, a) => s + Number(a.current_balance ?? a.balance ?? 0), 0);
}

export default function UniverseHandling() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<InstitutionData[]>([]);
  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plaidRes, manualRes, hiddenRes, catRes] = await Promise.all([
        supabase.functions.invoke('fetch-balances'),
        supabase.from('manual_accounts' as any).select('*'),
        supabase.from('account_balances' as any).select('account_id, is_hidden').eq('is_hidden', true),
        supabase.from('account_categories' as any).select('*'),
      ]);

      const plaidInstitutions: InstitutionData[] = plaidRes.data?.institutions || [];
      const hiddenIds = new Set(((hiddenRes.data || []) as any[]).map((r: any) => r.account_id));
      const catData = (catRes.data || []) as any[];
      const catMap = new Map<string, string>();
      for (const c of catData) {
        catMap.set(`${c.account_source}:${c.account_id}`, c.category);
      }

      for (const inst of plaidInstitutions) {
        for (const acct of inst.accounts) {
          acct.is_hidden = hiddenIds.has(acct.account_id);
          acct.category = catMap.get(`plaid:${acct.account_id}`) || defaultPlaidCategory(acct.type, acct.subtype);
        }
      }

      // Filter to only debt accounts
      const debtInstitutions = plaidInstitutions.map((inst) => ({
        ...inst,
        accounts: inst.accounts.filter((a) => a.category === 'debt'),
      })).filter((inst) => inst.accounts.length > 0);

      const manual = ((manualRes.data || []) as any[]).map((a: any) => ({
        ...a,
        category: catMap.get(`manual:${a.id}`) || defaultManualCategory(a.account_type),
      })).filter((a: any) => a.category === 'debt') as ManualAccount[];

      setInstitutions(debtInstitutions);
      setManualAccounts(manual);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleTogglePlaidAccount = async (accountId: string, hidden: boolean) => {
    try {
      const { error } = await (supabase.from('account_balances' as any) as any)
        .update({ is_hidden: hidden }).eq('account_id', accountId);
      if (error) throw error;
      setInstitutions((prev) =>
        prev.map((inst) => ({
          ...inst, accounts: inst.accounts.map((a) => a.account_id === accountId ? { ...a, is_hidden: hidden } : a),
        }))
      );
    } catch { toast.error('Failed to update account visibility'); }
  };

  const handleToggleManualAccount = async (accountId: string, hidden: boolean) => {
    try {
      const { error } = await (supabase.from('manual_accounts' as any) as any)
        .update({ is_hidden: hidden }).eq('id', accountId);
      if (error) throw error;
      setManualAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, is_hidden: hidden } : a))
      );
    } catch { toast.error('Failed to update account visibility'); }
  };

  const handleDeletePlaidAccount = async (accountId: string) => {
    try {
      const { error } = await (supabase.from('account_balances' as any) as any)
        .delete().eq('account_id', accountId);
      if (error) throw error;
      setInstitutions((prev) =>
        prev.map((inst) => ({
          ...inst, accounts: inst.accounts.filter((a) => a.account_id !== accountId),
        })).filter((inst) => inst.accounts.length > 0)
      );
      toast.success('Account removed');
    } catch { toast.error('Failed to remove account'); }
  };

  const handleDeleteManualAccount = async (accountId: string) => {
    try {
      const { error } = await (supabase.from('manual_accounts' as any) as any)
        .delete().eq('id', accountId);
      if (error) throw error;
      setManualAccounts((prev) => prev.filter((a) => a.id !== accountId));
      toast.success('Account removed');
    } catch { toast.error('Failed to remove account'); }
  };

  const { deduped, sharedKeys } = deduplicateInstitutions(institutions);

  const groupManual = (list: ManualAccount[]) =>
    list.reduce<Record<string, ManualAccount[]>>((acc, a) => { (acc[a.institution_name] ||= []).push(a); return acc; }, {});

  const manualByInst = groupManual(manualAccounts);

  const totalDebt =
    sumVisible(deduped.flatMap((i) => i.accounts)) +
    sumVisible(manualAccounts.map((a) => ({ current_balance: Number(a.balance), is_hidden: a.is_hidden })));

  const hasAny = deduped.length > 0 || manualAccounts.length > 0;

  const mapPlaid = (inst: InstitutionData) => (accounts: AccountData[]) =>
    accounts.map((a) => ({
      id: a.account_id,
      name: a.name,
      type: a.subtype || a.type,
      balance: a.current_balance,
      isHidden: a.is_hidden,
      isShared: sharedKeys.has(dedupKey(inst.institution, a.name)),
    }));

  const mapManual = (accounts: ManualAccount[]) =>
    accounts.map((a) => ({ id: a.id, name: a.account_name, type: a.account_type, balance: Number(a.balance), isHidden: a.is_hidden }));

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">The Universe Is Handling This</h1>
        </div>

        {loading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-card p-6 md:p-8"
          >
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">
              Total Being Handled
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight font-mono">
              ${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </motion.div>
        )}

        {loading ? (
          <div className="grid gap-4">{[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
        ) : !hasAny ? (
          <div className="text-center py-16 space-y-3">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Nothing here — the universe has a clean slate.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {deduped.map((inst, i) => (
              <BankAccountCard
                key={`${inst.institution}-${inst.connection_id}`}
                institution={inst.institution}
                accounts={mapPlaid(inst)(inst.accounts)}
                index={i}
                onToggleAccount={handleTogglePlaidAccount}
                onDeleteAccount={handleDeletePlaidAccount}
              />
            ))}
            {Object.entries(manualByInst).map(([instName, accounts], i) => (
              <BankAccountCard
                key={`manual-${instName}`}
                institution={`${instName} (manual)`}
                accounts={mapManual(accounts)}
                index={deduped.length + i}
                onToggleAccount={handleToggleManualAccount}
                onDeleteAccount={handleDeleteManualAccount}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
