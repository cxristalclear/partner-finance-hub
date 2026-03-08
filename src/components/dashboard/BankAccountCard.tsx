import { useState } from 'react';
import { Landmark, Wallet, Settings2, Trash2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Account {
  id?: string;
  name: string;
  type: string;
  balance: number;
  isHidden?: boolean;
  isShared?: boolean;
}

interface BankAccountCardProps {
  institution: string;
  accounts: Account[];
  index: number;
  onToggleAccount?: (accountId: string, hidden: boolean) => void;
  onDeleteAccount?: (accountId: string) => void;
}

export function BankAccountCard({ institution, accounts, index, onToggleAccount, onDeleteAccount }: BankAccountCardProps) {
  const [editing, setEditing] = useState(false);

  const visibleAccounts = editing ? accounts : accounts.filter((a) => !a.isHidden);
  const total = visibleAccounts
    .filter((a) => !a.isHidden)
    .reduce((sum, a) => sum + a.balance, 0);

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
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium">
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          {onToggleAccount && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(!editing)}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {visibleAccounts.map((account, i) => (
          <div key={account.id || i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              {editing && account.id && onToggleAccount ? (
                <div className="flex items-center gap-1">
                  <Switch
                    checked={!account.isHidden}
                    onCheckedChange={(checked) => onToggleAccount(account.id!, !checked)}
                    className="scale-75 origin-left"
                  />
                  {onDeleteAccount && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive/80"
                      onClick={() => onDeleteAccount(account.id!)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ) : (
                <Wallet className="w-3.5 h-3.5" />
              )}
              <span className={account.isHidden ? 'line-through opacity-50' : ''}>{account.name}</span>
              {account.isShared && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 cursor-default">
                        <Users className="w-2.5 h-2.5" />
                        Joint
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This account is shared between partners</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                {account.type}
              </span>
            </div>
            <span className={`font-mono ${account.isHidden ? 'line-through opacity-50' : ''}`}>
              ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        {!editing && accounts.some((a) => a.isHidden) && (
          <p className="text-xs text-muted-foreground italic">
            {accounts.filter((a) => a.isHidden).length} account(s) hidden
          </p>
        )}
      </div>
    </motion.div>
  );
}
