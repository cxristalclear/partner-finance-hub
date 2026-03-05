import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
// import { usePlaidLink } from 'react-plaid-link';
// import { supabase } from '@/integrations/supabase/client';

export function ConnectBankButton() {
  const [loading, setLoading] = useState(false);

  // Placeholder: In production, fetch a link_token from your edge function
  // const { open, ready } = usePlaidLink({
  //   token: linkToken,
  //   onSuccess: async (publicToken, metadata) => {
  //     // Exchange public token via edge function
  //     const { data, error } = await supabase.functions.invoke('plaid-exchange', {
  //       body: { public_token: publicToken, institution: metadata.institution },
  //     });
  //     if (error) toast.error('Failed to connect bank');
  //     else toast.success(`Connected ${metadata.institution?.name}`);
  //   },
  // });

  const handleConnect = () => {
    setLoading(true);
    // Placeholder: open Plaid Link
    toast.info('Plaid Link integration ready — add your PLAID_CLIENT_ID and PLAID_SECRET to Cloud secrets to activate.');
    setLoading(false);
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={loading}
      variant="outline"
      className="border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
    >
      <Plus className="w-4 h-4 mr-2" />
      Connect Bank
    </Button>
  );
}
