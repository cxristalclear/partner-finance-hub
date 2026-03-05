import { Landmark, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

interface Account {
  name: string;
  type: string;
  balance: number;
}

interface BankAccountCardProps {
  institution: string;
  accounts: Account[];
  index: number;
}

export function BankAccountCard({ institution, accounts, index }: BankAccountCardProps) {
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 * index }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Landmark className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{institution}</h3>
        </div>
        <span className="text-sm font-mono font-medium">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <div className="space-y-3">
        {accounts.map((account, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="w-3.5 h-3.5" />
              <span>{account.name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                {account.type}
              </span>
            </div>
            <span className="font-mono">
              ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
