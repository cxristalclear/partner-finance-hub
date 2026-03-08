import { useEffect, useState } from 'react';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { NetWorthCard } from '@/components/dashboard/NetWorthCard';
import { BankAccountCard } from '@/components/dashboard/BankAccountCard';
import { ConnectBankButton } from '@/components/dashboard/ConnectBankButton';
import { AddManualAccountDialog } from '@/components/dashboard/AddManualAccountDialog';
import { AddManualAccountDialog } from '@/components/dashboard/AddManualAccountDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const DEBT_TYPES = new Set(['credit', 'loan', 'mortgage']);
const DEBT_SUBTYPES = new Set(['credit card', 'student', 'auto', 'mortgage', 'personal', 'home equity']);

function defaultCategory(type: string, subtype?: string): string {
  const t = type.toLowerCase();
  const s = (subtype || '').toLowerCase();
  if (DEBT_TYPES.has(t) || DEBT_SUBTYPES.has(s)) return 'debt';
  if (t === 'investment' || ['401k', 'ira', 'brokerage'].includes(s)) return 'investment';
  return 'net_worth';
}

function defaultManualCategory(accountType: string): string {
  if (['Credit Card', 'Loan', 'Mortgage'].includes(accountType)) return 'debt';
  if (['Investment', 'Retirement'].includes(accountType)) return 'investment';
  return 'net_worth';
}

/** Deduplicate accounts across institutions by account_id (joint accounts) */
function deduplicateInstitutions(institutions: InstitutionData[]): InstitutionData[] {
  const seen = new Set<string>();
  return institutions.map((inst) => ({
    ...inst,
    accounts: inst.accounts.filter((a) => {
      if (seen.has(a.account_id)) return false;
      seen.add(a.account_id);
      return true;
    }),
  })).filter((inst) => inst.accounts.length > 0);
}

type Category = 'net_worth' | 'debt' | 'investment' | 'exclude';

function filterByCategory(institutions: InstitutionData[], cat: Category): InstitutionData[] {
  return institutions
    .map((inst) => ({ ...inst, accounts: inst.accounts.filter((a) => a.category === cat) }))
    .filter((inst) => inst.accounts.length > 0);
}

function sumVisible(accounts: { current_balance?: number; balance?: number; is_hidden?: boolean }[]) {
  return accounts.filter((a) => !a.is_hidden).reduce((s, a) => s + Number(a.current_balance ?? a.balance ?? 0), 0);
}

export default function Dashboard() {
  const [institutions, setInstitutions] = useState<InstitutionData[]>([]);
  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalDebts, setTotalDebts] = useState(0);

  const updateTotals = (insts: InstitutionData[], manual: ManualAccount[]) => {
    const deduped = deduplicateInstitutions(insts);
    const nwAccounts = deduped.flatMap((i) => i.accounts.filter((a) => a.category === 'net_worth'));
    const invAccounts = deduped.flatMap((i) => i.accounts.filter((a) => a.category === 'investment'));
    const debtAccounts = deduped.flatMap((i) => i.accounts.filter((a) => a.category === 'debt'));

    const manualNW = manual.filter((a) => a.category === 'net_worth');
    const manualInv = manual.filter((a) => a.category === 'investment');
    const manualDebt = manual.filter((a) => a.category === 'debt');

    const assets = sumVisible(nwAccounts) + sumVisible(invAccounts) + sumVisible(manualNW) + sumVisible(manualInv);
    const debts = sumVisible(debtAccounts) + sumVisible(manualDebt);

    setTotalAssets(assets);
    setTotalDebts(debts);
  };

  const fetchBalances = async () => {
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
          acct.category = catMap.get(`plaid:${acct.account_id}`) || defaultCategory(acct.type, acct.subtype);
        }
      }

      const manual = ((manualRes.data || []) as any[]).map((a: any) => ({
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
      const { error } = await (supabase.from('account_balances' as any) as any)
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
      const { error } = await (supabase.from('manual_accounts' as any) as any)
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
      const { error } = await (supabase.from('account_balances' as any) as any)
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

  const deduped = deduplicateInstitutions(institutions);
  const plaidNW = filterByCategory(deduped, 'net_worth');
  const plaidDebt = filterByCategory(deduped, 'debt');
  const plaidInv = filterByCategory(deduped, 'investment');

  const manualNW = manualAccounts.filter((a) => a.category === 'net_worth');
  const manualDebt = manualAccounts.filter((a) => a.category === 'debt');
  const manualInv = manualAccounts.filter((a) => a.category === 'investment');

  const groupManual = (list: ManualAccount[]) =>
    list.reduce<Record<string, ManualAccount[]>>((acc, a) => { (acc[a.institution_name] ||= []).push(a); return acc; }, {});

  const manualNWByInst = groupManual(manualNW);
  const manualDebtByInst = groupManual(manualDebt);
  const manualInvByInst = groupManual(manualInv);

  const hasAnyAccounts = institutions.length > 0 || manualAccounts.length > 0;

  const mapPlaid = (accounts: AccountData[]) =>
    accounts.map((a) => ({ id: a.account_id, name: a.name, type: a.subtype || a.type, balance: a.current_balance, isHidden: a.is_hidden }));

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
              <BankAccountCard key={inst.institution} institution={inst.institution} accounts={mapPlaid(inst.accounts)}
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
          <NetWorthCard totalAssets={totalAssets} totalDebts={totalDebts} />
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <InvitePartnerDialog />
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
            {renderSection('Debts', plaidDebt, manualDebtByInst, 0.5)}
          </div>
        )}

        {!loading && hasAnyAccounts && (
          <p className="text-center text-xs text-muted-foreground pt-4">Data refreshed from Plaid · Last sync: just now</p>
        )}
      </main>
    </div>
  );
}
