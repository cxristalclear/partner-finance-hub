import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface NetWorthCardProps {
  totalBalance: number;
  changePercent?: number;
}

export function NetWorthCard({ totalBalance, changePercent = 0 }: NetWorthCardProps) {
  const isPositive = changePercent >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card p-6 md:p-8 glow-accent"
    >
      <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">
        Combined Net Worth
      </p>
      <div className="flex items-end gap-3 mb-2">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight font-mono">
          ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h2>
        {changePercent !== 0 && (
          <span className={`inline-flex items-center gap-1 text-sm font-medium pb-1 ${isPositive ? 'text-success' : 'text-destructive'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Across all linked accounts</p>
    </motion.div>
  );
}
