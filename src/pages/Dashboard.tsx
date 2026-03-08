import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { NetWorthCard } from '@/components/dashboard/NetWorthCard';
import { BankAccountCard } from '@/components/dashboard/BankAccountCard';
import { ConnectBankButton } from '@/components/dashboard/ConnectBankButton';
import { AddManualAccountDialog } from '@/components/dashboard/AddManualAccountDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { defaultPlaidCategory, defaultManualCategory, type Category } from '@/lib/categories';

interface AccountData {
  account_id: string;
  name: string;
  type: string;
  subtype?: string;
  current_balance: number;
  is_hidden?: boolean;
  category?: string;
  institution?: string;
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

/** Build a dedup key from institution + account name */
function dedupKey(institution: string, accountName: string): string {
  return `${institution.toLowerCase()}:${accountName.toLowerCase()}`;
}

/** Deduplicate accounts across institutions by institution+name (joint accounts) */
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

function filterByCategory(institutions: InstitutionData[], cat: Category): InstitutionData[] {
  return institutions
    .map((inst) => ({ ...inst, accounts: inst.accounts.filter((a) => a.category === cat) }))
    .filter((inst) => inst.accounts.length > 0);
}

function sumVisible(accounts: { current_balance?: number; balance?: number; is_hidden?: boolean }[]) {
  return accounts.filter((a) => !a.is_hidden).reduce((s, a) => s + Number(a.current_balance ?? a.balance ?? 0), 0);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<InstitutionData[]>([]);
  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAssets, setTotalAssets] = useState(0);
  const [debtCount, setDebtCount] = useState(0);

  const updateTotals = (insts: InstitutionData[], manual: ManualAccount[]) => {
    const { deduped } = deduplicateInstitutions(insts);
    const nwAccounts = deduped.flatMap((i) => i.accounts.filter((a) => a.category === 'net_worth'));
    const invAccounts = deduped.flatMap((i) => i.accounts.filter((a) => a.category === 'investment'));
    const debtAccounts = deduped.flatMap((i) => i.accounts.filter((a) => a.category === 'debt'));

    const manualNW = manual.filter((a) => a.category === 'net_worth');
    const manualInv = manual.filter((a) => a.category === 'investment');
    const manualDebt = manual.filter((a) => a.category === 'debt');

    const assets = sumVisible(nwAccounts) + sumVisible(invAccounts) + sumVisible(manualNW) + sumVisible(manualInv);
    const dCount = debtAccounts.filter((a) => !a.is_hidden).length + manualDebt.filter((a) => !a.is_hidden).length;

    setTotalAssets(assets);
    setDebtCount(dCount);
  };

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const [plaidRes, manualRes, hiddenRes, catRes] = await Promise.all([
        supabase.functions.invoke('fetch-balances'),
        supabase.from('manual_accounts').select('*'),
        supabase.from('account_balances').select('account_id, is_hidden').eq('is_hidden', true),
        supabase.from('account_categories').select('*'),
      ]);

      const plaidInstitutions: InstitutionData[] = plaidRes.data?.institutions || [];
      const hiddenIds = new Set((hiddenRes.data || []).map((r) => r.account_id));
      const catData = catRes.data || [];
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

      const manual = (manualRes.data || []).map((a) => ({
        ...a,
        category: catMap.get(`manual:${a.id}`) || defaultManualCategory(a.account_type),
      })) as ManualAccount[];

      setInstitutions(plaidInstitutions);
      setManualAccounts(manual);
      updateTotals(plaidInstitutions, manual);
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBalances(); }, []);

  const handleTogglePlaidAccount = async (accountId: string, hidden: boolean) => {
    try {
      const { error } = await supabase.from('account_balances')
        .update({ is_hidden: hidden }).eq('account_id', accountId);
      if (error) throw error;
      setInstitutions((prev) => {
        const updated = prev.map((inst) => ({
          ...inst, accounts: inst.accounts.map((a) => a.account_id === accountId ? { ...a, is_hidden: hidden } : a),
        }));
        updateTotals(updated, manualAccounts);
        return updated;
      });
    } catch { toast.error('Failed to update account visibility'); }
  };

  const handleToggleManualAccount = async (accountId: string, hidden: boolean) => {
    try {
      const { error } = await supabase.from('manual_accounts')
        .update({ is_hidden: hidden }).eq('id', accountId);
      if (error) throw error;
      setManualAccounts((prev) => {
        const updated = prev.map((a) => (a.id === accountId ? { ...a, is_hidden: hidden } : a));
        updateTotals(institutions, updated);
        return updated;
      });
    } catch { toast.error('Failed to update account visibility'); }
  };

  const handleDeletePlaidAccount = async (accountId: string) => {
    try {
      const { error } = await supabase.from('account_balances')
        .delete().eq('account_id', accountId);
      if (error) throw error;
      setInstitutions((prev) => {
        const updated = prev.map((inst) => ({
          ...inst, accounts: inst.accounts.filter((a) => a.account_id !== accountId),
        })).filter((inst) => inst.accounts.length > 0);
        updateTotals(updated, manualAccounts);
        return updated;
      });
      toast.success('Account removed');
    } catch { toast.error('Failed to remove account'); }
  };

  const handleDeleteManualAccount = async (accountId: string) => {
    try {
      const { error } = await (supabase.from('manual_accounts' as any) as any)
        .delete().eq('id', accountId);
      if (error) throw error;
      setManualAccounts((prev) => {
        const updated = prev.filter((a) => a.id !== accountId);
        updateTotals(institutions, updated);
        return updated;
      });
      toast.success('Account removed');
    } catch { toast.error('Failed to remove account'); }
  };

  const { deduped, sharedKeys } = deduplicateInstitutions(institutions);
  const plaidNW = filterByCategory(deduped, 'net_worth');
  const plaidInv = filterByCategory(deduped, 'investment');

  const manualNW = manualAccounts.filter((a) => a.category === 'net_worth');
  const manualInv = manualAccounts.filter((a) => a.category === 'investment');

  const groupManual = (list: ManualAccount[]) =>
    list.reduce<Record<string, ManualAccount[]>>((acc, a) => { (acc[a.institution_name] ||= []).push(a); return acc; }, {});

  const manualNWByInst = groupManual(manualNW);
  const manualInvByInst = groupManual(manualInv);

  const hasAnyAccounts = institutions.length > 0 || manualAccounts.length > 0;

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

  const renderSection = (
    title: string,
    plaid: InstitutionData[],
    manualByInst: Record<string, ManualAccount[]>,
    delay: number
  ) => {
    const hasContent = plaid.length > 0 || Object.keys(manualByInst).length > 0;
    return (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
        </motion.div>
        {!loading && (
          <div className="grid gap-4">
            {plaid.map((inst, i) => (
              <BankAccountCard key={`${inst.institution}-${inst.connection_id}`} institution={inst.institution} accounts={mapPlaid(inst)(inst.accounts)}
                index={i} onToggleAccount={handleTogglePlaidAccount} onDeleteAccount={handleDeletePlaidAccount} />
            ))}
            {Object.entries(manualByInst).map(([instName, accounts], i) => (
              <BankAccountCard key={`manual-${instName}`} institution={`${instName} (manual)`} accounts={mapManual(accounts)}
                index={plaid.length + i} onToggleAccount={handleToggleManualAccount} onDeleteAccount={handleDeleteManualAccount} />
            ))}
            {!hasContent && (
              <p className="text-center text-sm text-muted-foreground py-4">No accounts in this category</p>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        {loading ? <Skeleton className="h-36 w-full rounded-xl" /> : (
          <NetWorthCard totalAssets={totalAssets} />
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <AddManualAccountDialog onSuccess={fetchBalances} />
            <ConnectBankButton onSuccess={fetchBalances} />
          </div>
        </motion.div>

        {loading ? (
          <div className="grid gap-4">{[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
        ) : !hasAnyAccounts ? (
          <p className="text-center text-sm text-muted-foreground py-12">No accounts yet. Connect a bank or add one manually.</p>
        ) : (
          <div className="space-y-6">
            {renderSection('Net Worth', plaidNW, manualNWByInst, 0.3)}
            {renderSection('Investments', plaidInv, manualInvByInst, 0.4)}
          </div>
        )}

        {!loading && debtCount > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <button
              onClick={() => navigate('/universe')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              The Universe Is Handling {debtCount} account{debtCount !== 1 ? 's' : ''}
            </button>
          </motion.div>
        )}

        {!loading && hasAnyAccounts && (
          <p className="text-center text-xs text-muted-foreground pt-4">Data refreshed from Plaid · Last sync: just now</p>
        )}
      </main>
    </div>
  );
}
