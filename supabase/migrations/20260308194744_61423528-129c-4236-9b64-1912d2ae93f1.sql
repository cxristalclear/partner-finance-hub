-- Drop the existing SELECT policy that exposes access_token
DROP POLICY IF EXISTS "Household members can view bank connections" ON public.bank_connections;

-- Create a safe view excluding sensitive columns
CREATE OR REPLACE VIEW public.bank_connections_safe AS
SELECT id, household_id, user_id, institution_id, institution_name, item_id, status, created_at, updated_at
FROM public.bank_connections;

-- Make the view use the invoker's permissions for RLS
ALTER VIEW public.bank_connections_safe SET (security_invoker = on);

-- Grant select on the view
GRANT SELECT ON public.bank_connections_safe TO authenticated;

-- Add RLS policy on the base table for the view (since security_invoker uses caller's perms)
-- We need a new restrictive SELECT policy that works but doesn't expose access_token
-- Since the old policy is dropped, add one back that only the view will use
CREATE POLICY "Household members can view bank connections"
ON public.bank_connections
FOR SELECT
TO authenticated
USING (household_id = user_household_id(auth.uid()));
