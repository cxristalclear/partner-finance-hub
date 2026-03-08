ALTER TABLE public.account_balances
  ADD CONSTRAINT account_balances_connection_account_unique
  UNIQUE (bank_connection_id, account_id);