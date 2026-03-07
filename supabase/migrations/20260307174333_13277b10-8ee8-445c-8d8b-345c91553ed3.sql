
-- Add is_hidden column to account_balances
ALTER TABLE public.account_balances ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;

-- Allow household members to update account_balances (for toggling visibility)
CREATE POLICY "Household members can update balances"
ON public.account_balances
FOR UPDATE
TO authenticated
USING (bank_connection_id IN (
  SELECT id FROM bank_connections WHERE household_id = user_household_id(auth.uid())
))
WITH CHECK (bank_connection_id IN (
  SELECT id FROM bank_connections WHERE household_id = user_household_id(auth.uid())
));

-- Add is_hidden column to manual_accounts
ALTER TABLE public.manual_accounts ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
