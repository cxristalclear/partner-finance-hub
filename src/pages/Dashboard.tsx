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

interface AccountData {
  name: string;
  type: string;
  subtype?: string;
  current_balance: number;
}

interface InstitutionData {
  institution: string;
  accounts: AccountData[];
}

interface ManualAccount {
  id: string;
  institution_name: string;
  account_name: string;
  account_type: string;
  balance: number;
}

export default function Dashboard() {
  const [institutions, setInstitutions] = useState<InstitutionData[]>([]);
  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const [plaidRes, manualRes] = await Promise.all([
        supabase.functions.invoke('fetch-balances'),
        supabase.from('manual_accounts' as any).select('*'),
      ]);

      const plaidInstitutions = plaidRes.data?.institutions || [];
      const plaidTotal = plaidRes.data?.total_balance || 0;

      const manual = (manualRes.data || []) as unknown as ManualAccount[];
      setManualAccounts(manual);

      const manualTotal = manual.reduce((sum, a) => sum + Number(a.balance), 0);

      setInstitutions(plaidInstitutions);
      setTotalBalance(plaidTotal + manualTotal);
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

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
                  name: a.name,
                  type: a.subtype || a.type,
                  balance: a.current_balance,
                }))}
                index={i}
              />
            ))}

            {Object.entries(manualByInstitution).map(([instName, accounts], i) => (
              <BankAccountCard
                key={`manual-${instName}`}
                institution={`${instName} (manual)`}
                accounts={accounts.map((a) => ({
                  name: a.account_name,
                  type: a.account_type,
                  balance: Number(a.balance),
                }))}
                index={institutions.length + i}
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
