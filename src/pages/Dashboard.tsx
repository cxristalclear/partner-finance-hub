import { useEffect, useState } from 'react';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { NetWorthCard } from '@/components/dashboard/NetWorthCard';
import { BankAccountCard } from '@/components/dashboard/BankAccountCard';
import { ConnectBankButton } from '@/components/dashboard/ConnectBankButton';
import { InvitePartnerDialog } from '@/components/dashboard/InvitePartnerDialog';
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
}

const DEBT_TYPES = new Set(['credit', 'loan', 'mortgage']);
const DEBT_SUBTYPES = new Set(['credit card', 'student', 'auto', 'mortgage', 'personal', 'home equity']);
const DEBT_ACCOUNT_TYPES = new Set(['Credit Card', 'Loan', 'Mortgage']);

function isDebtAccount(type: string, subtype?: string): boolean {
  return DEBT_TYPES.has(type.toLowerCase()) || DEBT_SUBTYPES.has((subtype || '').toLowerCase());
}

function isManualDebt(accountType: string): boolean {
  return DEBT_ACCOUNT_TYPES.has(accountType);
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

function splitByDebt(institutions: InstitutionData[]) {
  const assets: InstitutionData[] = [];
  const debts: InstitutionData[] = [];
  for (const inst of institutions) {
    const assetAccounts = inst.accounts.filter((a) => !isDebtAccount(a.type, a.subtype));
    const debtAccounts = inst.accounts.filter((a) => isDebtAccount(a.type, a.subtype));
    if (assetAccounts.length > 0) assets.push({ ...inst, accounts: assetAccounts });
    if (debtAccounts.length > 0) debts.push({ ...inst, accounts: debtAccounts });
  }
  return { assets, debts };
}

function splitManualByDebt(accounts: ManualAccount[]) {
  return {
    assets: accounts.filter((a) => !isManualDebt(a.account_type)),
    debts: accounts.filter((a) => isManualDebt(a.account_type)),
  };
}

function sumVisible(accounts: { current_balance?: number; balance?: number; is_hidden?: boolean }[]) {
  return accounts.filter((a) => !a.is_hidden).reduce((s, a) => s + Number(a.current_balance ?? a.balance ?? 0), 0);
}

export default function Dashboard() {
  const [institutions, setInstitutions] = useState<InstitutionData[]>([]);
  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const computeTotals = (insts: InstitutionData[], manual: ManualAccount[]) => {
    const deduped = deduplicateInstitutions(insts);
    const { assets: plaidAssets, debts: plaidDebts } = splitByDebt(deduped);
    const { assets: manualAssets, debts: manualDebts } = splitManualByDebt(manual);
    const totalAssets =
      plaidAssets.reduce((s, i) => s + sumVisible(i.accounts), 0) +
      sumVisible(manualAssets);
    const totalDebts =
      plaidDebts.reduce((s, i) => s + sumVisible(i.accounts), 0) +
      sumVisible(manualDebts);
    return { totalAssets, totalDebts };
  };

  const [totalAssets, setTotalAssets] = useState(0);
  const [totalDebts, setTotalDebts] = useState(0);

  const updateTotals = (insts: InstitutionData[], manual: ManualAccount[]) => {
    const { totalAssets: a, totalDebts: d } = computeTotals(insts, manual);
    setTotalAssets(a);
    setTotalDebts(d);
  };

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const [plaidRes, manualRes, hiddenRes] = await Promise.all([
        supabase.functions.invoke('fetch-balances'),
        supabase.from('manual_accounts' as any).select('*'),
        supabase.from('account_balances' as any).select('account_id, is_hidden').eq('is_hidden', true),
      ]);

      const plaidInstitutions: InstitutionData[] = plaidRes.data?.institutions || [];
      const hiddenIds = new Set(((hiddenRes.data || []) as any[]).map((r: any) => r.account_id));

      for (const inst of plaidInstitutions) {
        for (const acct of inst.accounts) {
          acct.is_hidden = hiddenIds.has(acct.account_id);
        }
      }

      const manual = (manualRes.data || []) as unknown as ManualAccount[];

      setInstitutions(plaidInstitutions);
      setManualAccounts(manual);
      updateTotals(plaidInstitutions, manual);
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const handleTogglePlaidAccount = async (accountId: string, hidden: boolean) => {
    try {
      const { error } = await (supabase.from('account_balances' as any) as any)
        .update({ is_hidden: hidden })
        .eq('account_id', accountId);
      if (error) throw error;

      setInstitutions((prev) => {
        const updated = prev.map((inst) => ({
          ...inst,
          accounts: inst.accounts.map((a) =>
            a.account_id === accountId ? { ...a, is_hidden: hidden } : a
          ),
        }));
        updateTotals(updated, manualAccounts);
        return updated;
      });
    } catch {
      toast.error('Failed to update account visibility');
    }
  };

  const handleToggleManualAccount = async (accountId: string, hidden: boolean) => {
    try {
      const { error } = await (supabase.from('manual_accounts' as any) as any)
        .update({ is_hidden: hidden })
        .eq('id', accountId);
      if (error) throw error;

      setManualAccounts((prev) => {
        const updated = prev.map((a) => (a.id === accountId ? { ...a, is_hidden: hidden } : a));
        updateTotals(institutions, updated);
        return updated;
      });
    } catch {
      toast.error('Failed to update account visibility');
    }
  };

  const handleDeletePlaidAccount = async (accountId: string) => {
    try {
      const { error } = await (supabase.from('account_balances' as any) as any)
        .delete()
        .eq('account_id', accountId);
      if (error) throw error;

      setInstitutions((prev) => {
        const updated = prev.map((inst) => ({
          ...inst,
          accounts: inst.accounts.filter((a) => a.account_id !== accountId),
        })).filter((inst) => inst.accounts.length > 0);
        updateTotals(updated, manualAccounts);
        return updated;
      });
      toast.success('Account removed');
    } catch {
      toast.error('Failed to remove account');
    }
  };

  const handleDeleteManualAccount = async (accountId: string) => {
    try {
      const { error } = await (supabase.from('manual_accounts' as any) as any)
        .delete()
        .eq('id', accountId);
      if (error) throw error;

      setManualAccounts((prev) => {
        const updated = prev.filter((a) => a.id !== accountId);
        updateTotals(institutions, updated);
        return updated;
      });
      toast.success('Account removed');
    } catch {
      toast.error('Failed to remove account');
    }
  };

  // Deduplicate and split
  const deduped = deduplicateInstitutions(institutions);
  const { assets: plaidAssets, debts: plaidDebts } = splitByDebt(deduped);
  const { assets: manualAssetsList, debts: manualDebtsList } = splitManualByDebt(manualAccounts);

  const manualAssetsByInst = manualAssetsList.reduce<Record<string, ManualAccount[]>>((acc, a) => {
    (acc[a.institution_name] ||= []).push(a);
    return acc;
  }, {});
  const manualDebtsByInst = manualDebtsList.reduce<Record<string, ManualAccount[]>>((acc, a) => {
    (acc[a.institution_name] ||= []).push(a);
    return acc;
  }, {});

  const hasAnyAccounts = institutions.length > 0 || manualAccounts.length > 0;
  const hasDebts = plaidDebts.length > 0 || manualDebtsList.length > 0;

  const mapPlaidAccounts = (accounts: AccountData[]) =>
    accounts.map((a) => ({
      id: a.account_id,
      name: a.name,
      type: a.subtype || a.type,
      balance: a.current_balance,
      isHidden: a.is_hidden,
    }));

  const mapManualAccounts = (accounts: ManualAccount[]) =>
    accounts.map((a) => ({
      id: a.id,
      name: a.account_name,
      type: a.account_type,
      balance: Number(a.balance),
      isHidden: a.is_hidden,
    }));

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        {loading ? (
          <Skeleton className="h-36 w-full rounded-xl" />
        ) : (
          <NetWorthCard totalAssets={totalAssets} totalDebts={totalDebts} />
        )}

        {/* ASSETS */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Assets</h3>
          <div className="flex items-center gap-2">
            <InvitePartnerDialog />
            <AddManualAccountDialog onSuccess={fetchBalances} />
            <ConnectBankButton onSuccess={fetchBalances} />
          </div>
        </motion.div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : !hasAnyAccounts ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            No accounts yet. Connect a bank or add one manually.
          </p>
        ) : (
          <div className="grid gap-4">
            {plaidAssets.map((inst, i) => (
              <BankAccountCard
                key={inst.institution}
                institution={inst.institution}
                accounts={mapPlaidAccounts(inst.accounts)}
                index={i}
                onToggleAccount={handleTogglePlaidAccount}
                onDeleteAccount={handleDeletePlaidAccount}
              />
            ))}
            {Object.entries(manualAssetsByInst).map(([instName, accounts], i) => (
              <BankAccountCard
                key={`manual-${instName}`}
                institution={`${instName} (manual)`}
                accounts={mapManualAccounts(accounts)}
                index={plaidAssets.length + i}
                onToggleAccount={handleToggleManualAccount}
                onDeleteAccount={handleDeleteManualAccount}
              />
            ))}
            {plaidAssets.length === 0 && Object.keys(manualAssetsByInst).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">No asset accounts</p>
            )}
          </div>
        )}

        {/* DEBTS */}
        {(hasDebts || !loading) && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Debts</h3>
            </motion.div>
            {!loading && (
              <div className="grid gap-4">
                {plaidDebts.map((inst, i) => (
                  <BankAccountCard
                    key={`debt-${inst.institution}`}
                    institution={inst.institution}
                    accounts={mapPlaidAccounts(inst.accounts)}
                    index={i}
                    onToggleAccount={handleTogglePlaidAccount}
                    onDeleteAccount={handleDeletePlaidAccount}
                  />
                ))}
                {Object.entries(manualDebtsByInst).map(([instName, accounts], i) => (
                  <BankAccountCard
                    key={`manual-debt-${instName}`}
                    institution={`${instName} (manual)`}
                    accounts={mapManualAccounts(accounts)}
                    index={plaidDebts.length + i}
                    onToggleAccount={handleToggleManualAccount}
                    onDeleteAccount={handleDeleteManualAccount}
                  />
                ))}
                {plaidDebts.length === 0 && Object.keys(manualDebtsByInst).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">No debt accounts</p>
                )}
              </div>
            )}
          </>
        )}

        {!loading && hasAnyAccounts && (
          <p className="text-center text-xs text-muted-foreground pt-4">
            Data refreshed from Plaid · Last sync: just now
          </p>
        )}
      </main>
    </div>
  );
}
