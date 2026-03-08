
-- Create a security definer function to check if a bank_connection belongs to user's household
CREATE OR REPLACE FUNCTION public.bank_connection_household_id(_connection_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.bank_connections WHERE id = _connection_id
$$;

-- Drop old RLS policies on account_balances that reference bank_connections directly
DROP POLICY IF EXISTS "Household members can view balances" ON public.account_balances;
DROP POLICY IF EXISTS "Household members can update balances" ON public.account_balances;
DROP POLICY IF EXISTS "Household members can delete balances" ON public.account_balances;

-- Recreate using the security definer function (avoids needing SELECT on bank_connections)
CREATE POLICY "Household members can view balances"
  ON public.account_balances FOR SELECT TO authenticated
  USING (bank_connection_household_id(bank_connection_id) = user_household_id(auth.uid()));

CREATE POLICY "Household members can update balances"
  ON public.account_balances FOR UPDATE TO authenticated
  USING (bank_connection_household_id(bank_connection_id) = user_household_id(auth.uid()))
  WITH CHECK (bank_connection_household_id(bank_connection_id) = user_household_id(auth.uid()));

CREATE POLICY "Household members can delete balances"
  ON public.account_balances FOR DELETE TO authenticated
  USING (bank_connection_household_id(bank_connection_id) = user_household_id(auth.uid()));
