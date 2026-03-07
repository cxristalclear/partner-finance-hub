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

export default function Dashboard() {
  const [institutions, setInstitutions] = useState<InstitutionData[]>([]);
  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const computeTotal = (insts: InstitutionData[], manual: ManualAccount[]) => {
    const plaidTotal = insts.reduce(
      (sum, inst) =>
        sum + inst.accounts.filter((a) => !a.is_hidden).reduce((s, a) => s + a.current_balance, 0),
      0
    );
    const manualTotal = manual
      .filter((a) => !a.is_hidden)
      .reduce((sum, a) => sum + Number(a.balance), 0);
    return plaidTotal + manualTotal;
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

      // Mark hidden accounts
      for (const inst of plaidInstitutions) {
        for (const acct of inst.accounts) {
          acct.is_hidden = hiddenIds.has(acct.account_id);
        }
      }

      const manual = (manualRes.data || []) as unknown as ManualAccount[];

      setInstitutions(plaidInstitutions);
      setManualAccounts(manual);
      setTotalBalance(computeTotal(plaidInstitutions, manual));
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
        setTotalBalance(computeTotal(updated, manualAccounts));
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
        setTotalBalance(computeTotal(institutions, updated));
        return updated;
      });
    } catch {
      toast.error('Failed to update account visibility');
    }
  };

  // Group manual accounts by institution
  const manualByInstitution = manualAccounts.reduce<Record<string, ManualAccount[]>>((acc, a) => {
    (acc[a.institution_name] ||= []).push(a);
    return acc;
  }, {});

  const hasAnyAccounts = institutions.length > 0 || manualAccounts.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        {loading ? (
          <Skeleton className="h-36 w-full rounded-xl" />
        ) : (
          <NetWorthCard totalBalance={totalBalance} />
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between"
        >
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Linked Accounts
          </h3>
          <div className="flex items-center gap-2">
            <InvitePartnerDialog />
            <AddManualAccountDialog onSuccess={fetchBalances} />
            <ConnectBankButton onSuccess={fetchBalances} />
          </div>
        </motion.div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : !hasAnyAccounts ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            No accounts yet. Connect a bank or add one manually.
          </p>
        ) : (
          <div className="grid gap-4">
            {institutions.map((inst, i) => (
              <BankAccountCard
                key={inst.institution}
                institution={inst.institution}
                accounts={inst.accounts.map((a) => ({
                  id: a.account_id,
                  name: a.name,
                  type: a.subtype || a.type,
                  balance: a.current_balance,
                  isHidden: a.is_hidden,
                }))}
                index={i}
                onToggleAccount={handleTogglePlaidAccount}
              />
            ))}

            {Object.entries(manualByInstitution).map(([instName, accounts], i) => (
              <BankAccountCard
                key={`manual-${instName}`}
                institution={`${instName} (manual)`}
                accounts={accounts.map((a) => ({
                  id: a.id,
                  name: a.account_name,
                  type: a.account_type,
                  balance: Number(a.balance),
                  isHidden: a.is_hidden,
                }))}
                index={institutions.length + i}
                onToggleAccount={handleToggleManualAccount}
              />
            ))}
          </div>
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
