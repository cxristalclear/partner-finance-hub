import { useEffect, useState } from 'react';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { NetWorthCard } from '@/components/dashboard/NetWorthCard';
import { BankAccountCard } from '@/components/dashboard/BankAccountCard';
import { ConnectBankButton } from '@/components/dashboard/ConnectBankButton';
import { InvitePartnerDialog } from '@/components/dashboard/InvitePartnerDialog';
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

export default function Dashboard() {
  const [institutions, setInstitutions] = useState<InstitutionData[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-balances');
      if (error) throw error;
      setInstitutions(data?.institutions || []);
      setTotalBalance(data?.total_balance || 0);
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

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
          <ConnectBankButton onSuccess={fetchBalances} />
        </motion.div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : institutions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            No linked accounts yet. Connect a bank to get started.
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
          </div>
        )}

        {!loading && institutions.length > 0 && (
          <p className="text-center text-xs text-muted-foreground pt-4">
            Data refreshed from Plaid · Last sync: just now
          </p>
        )}
      </main>
    </div>
  );
}
