import { useState, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePlaidLink } from 'react-plaid-link';
import { supabase } from '@/integrations/supabase/client';

export function ConnectBankButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLinkToken = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('plaid-create-link-token');
      if (error) throw error;
      if (data?.link_token) {
        setLinkToken(data.link_token);
      } else {
        throw new Error(data?.error || 'Failed to create link token');
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not initialize Plaid Link');
    } finally {
      setLoading(false);
    }
  };

  const onPlaidSuccess = useCallback(async (publicToken: string, metadata: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('plaid-exchange', {
        body: { public_token: publicToken, institution: metadata.institution },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Connected ${metadata.institution?.name || 'bank'}`);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect bank');
    }
  }, [onSuccess]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  // Auto-open Plaid Link once the token is ready
  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const handleConnect = () => {
    if (linkToken && ready) {
      open();
    } else {
      fetchLinkToken();
    }
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={loading}
      variant="outline"
      className="border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
    >
      <Plus className="w-4 h-4 mr-2" />
      {loading ? 'Loading…' : 'Connect Bank'}
    </Button>
  );
}
