import { useState } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const ACCOUNT_TYPES = ['Checking', 'Savings', 'Investment', 'Retirement', 'Credit Card', 'Mortgage', 'Loan', 'Crypto', 'Real Estate', 'Other'];

export function AddManualAccountDialog({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [institution, setInstitution] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('Checking');
  const [balance, setBalance] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.household_id) throw new Error('No household found');

      const { error } = await supabase.from('manual_accounts' as any).insert({
        household_id: profile.household_id,
        created_by: user.id,
        institution_name: institution.trim(),
        account_name: accountName.trim(),
        account_type: accountType,
        balance: parseFloat(balance) || 0,
      } as any);

      if (error) throw error;

      toast.success('Manual account added');
      setInstitution('');
      setAccountName('');
      setAccountType('Checking');
      setBalance('');
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-primary" />
            Add Manual Account
          </DialogTitle>
          <DialogDescription>
            Track accounts that can't be linked through Plaid.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="institution">Institution</Label>
            <Input
              id="institution"
              placeholder="e.g. Coinbase, Zillow estimate"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountName">Account Name</Label>
            <Input
              id="accountName"
              placeholder="e.g. Bitcoin Wallet, Home Equity"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">Balance</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Account'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
