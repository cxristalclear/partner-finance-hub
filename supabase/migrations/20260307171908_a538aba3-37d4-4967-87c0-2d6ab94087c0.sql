
CREATE TABLE public.manual_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  institution_name text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL DEFAULT 'Other',
  balance numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view manual accounts"
  ON public.manual_accounts FOR SELECT
  TO authenticated
  USING (household_id = user_household_id(auth.uid()));

CREATE POLICY "Users can insert manual accounts"
  ON public.manual_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id = user_household_id(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update manual accounts"
  ON public.manual_accounts FOR UPDATE
  TO authenticated
  USING (household_id = user_household_id(auth.uid()));

CREATE POLICY "Users can delete manual accounts"
  ON public.manual_accounts FOR DELETE
  TO authenticated
  USING (household_id = user_household_id(auth.uid()));

CREATE TRIGGER update_manual_accounts_updated_at
  BEFORE UPDATE ON public.manual_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
