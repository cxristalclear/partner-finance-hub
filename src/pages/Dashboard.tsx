import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { NetWorthCard } from '@/components/dashboard/NetWorthCard';
import { BankAccountCard } from '@/components/dashboard/BankAccountCard';
import { ConnectBankButton } from '@/components/dashboard/ConnectBankButton';
import { motion } from 'framer-motion';

// Placeholder data — replaced by live Plaid data once connected
const MOCK_INSTITUTIONS = [
  {
    institution: 'Chase',
    accounts: [
      { name: 'Checking ••4921', type: 'Checking', balance: 12450.82 },
      { name: 'Savings ••7733', type: 'Savings', balance: 34200.0 },
    ],
  },
  {
    institution: 'Vanguard',
    accounts: [
      { name: 'Brokerage ••1102', type: 'Investment', balance: 87320.15 },
      { name: 'Roth IRA ••5590', type: 'Retirement', balance: 41050.0 },
    ],
  },
  {
    institution: 'Marcus by Goldman Sachs',
    accounts: [
      { name: 'High-Yield Savings ••8844', type: 'Savings', balance: 15000.0 },
    ],
  },
];

export default function Dashboard() {
  const totalBalance = MOCK_INSTITUTIONS.reduce(
    (sum, inst) => sum + inst.accounts.reduce((s, a) => s + a.balance, 0),
    0
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        <NetWorthCard totalBalance={totalBalance} changePercent={1.24} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between"
        >
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Linked Accounts
          </h3>
          <ConnectBankButton />
        </motion.div>

        <div className="grid gap-4">
          {MOCK_INSTITUTIONS.map((inst, i) => (
            <BankAccountCard
              key={inst.institution}
              institution={inst.institution}
              accounts={inst.accounts}
              index={i}
            />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4">
          Data refreshed from Plaid · Last sync: just now
        </p>
      </main>
    </div>
  );
}
