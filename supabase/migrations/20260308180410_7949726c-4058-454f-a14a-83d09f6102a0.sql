-- Allow household members to delete account_balances (for removing individual accounts)
CREATE POLICY "Household members can delete balances"
ON public.account_balances
FOR DELETE
TO authenticated
USING (bank_connection_id IN (
  SELECT id FROM bank_connections WHERE household_id = user_household_id(auth.uid())
));