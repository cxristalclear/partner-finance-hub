-- Account category settings: maps each account to a display category
-- category can be: 'net_worth', 'debt', 'investment', 'exclude'
CREATE TABLE public.account_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  account_source text NOT NULL DEFAULT 'plaid', -- 'plaid' or 'manual'
  category text NOT NULL DEFAULT 'net_worth',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, account_id, account_source)
);

ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view account categories"
ON public.account_categories FOR SELECT TO authenticated
USING (household_id = user_household_id(auth.uid()));

CREATE POLICY "Household members can insert account categories"
ON public.account_categories FOR INSERT TO authenticated
WITH CHECK (household_id = user_household_id(auth.uid()));

CREATE POLICY "Household members can update account categories"
ON public.account_categories FOR UPDATE TO authenticated
USING (household_id = user_household_id(auth.uid()));

CREATE POLICY "Household members can delete account categories"
ON public.account_categories FOR DELETE TO authenticated
USING (household_id = user_household_id(auth.uid()));