-- Drop the SELECT policy so no one can query bank_connections directly
DROP POLICY IF EXISTS "Household members can view bank connections" ON public.bank_connections;

-- Drop the view we just created (we'll use a function instead)
DROP VIEW IF EXISTS public.bank_connections_safe;

-- Create a security definer function that returns safe columns for the user's household
CREATE OR REPLACE FUNCTION public.get_household_bank_connections()
RETURNS TABLE (
  id uuid,
  institution_name text,
  institution_id text,
  status text,
  user_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bc.id, bc.institution_name, bc.institution_id, bc.status, bc.user_id, bc.created_at
  FROM public.bank_connections bc
  WHERE bc.household_id = user_household_id(auth.uid())
$$;
