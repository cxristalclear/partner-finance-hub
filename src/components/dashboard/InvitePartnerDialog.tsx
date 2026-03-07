import { useState } from 'react';
import { UserPlus, X, Mail, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function InvitePartnerDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !user) return;

    setLoading(true);
    try {
      // Get user's household
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.household_id) {
        throw new Error('No household found');
      }

      const { error } = await supabase.from('household_invites').insert({
        household_id: profile.household_id,
        email: email.trim().toLowerCase(),
        invited_by: user.id,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('This email has already been invited');
        }
        throw error;
      }

      toast.success(`Invite sent! When ${email} signs up, they'll join your household.`);
      setEmail('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invite');
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
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Partner
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite Partner
          </DialogTitle>
          <DialogDescription>
            Enter their email. When they sign up, they'll automatically join your household and see all linked accounts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="flex gap-2 mt-2">
          <Input
            type="email"
            placeholder="sydney@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !email.trim()}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Invite
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
