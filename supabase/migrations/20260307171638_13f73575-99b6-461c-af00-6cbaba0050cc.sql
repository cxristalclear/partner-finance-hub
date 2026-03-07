
-- Table for pending household invitations
CREATE TABLE public.household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, email)
);

ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- Household members can view their invites
CREATE POLICY "Household members can view invites"
  ON public.household_invites FOR SELECT
  TO authenticated
  USING (household_id = user_household_id(auth.uid()));

-- Users can insert invites for their own household
CREATE POLICY "Users can create invites"
  ON public.household_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id = user_household_id(auth.uid())
    AND invited_by = auth.uid()
  );

-- Users can delete invites from their household
CREATE POLICY "Users can delete invites"
  ON public.household_invites FOR DELETE
  TO authenticated
  USING (household_id = user_household_id(auth.uid()));

-- Update handle_new_user to check for pending invites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invite_record RECORD;
  new_household_id UUID;
BEGIN
  -- Check if there's a pending invite for this email
  SELECT * INTO invite_record
  FROM public.household_invites
  WHERE email = NEW.email AND status = 'pending'
  LIMIT 1;

  IF invite_record IS NOT NULL THEN
    -- Join existing household
    new_household_id := invite_record.household_id;
    
    UPDATE public.household_invites
    SET status = 'accepted'
    WHERE id = invite_record.id;
  ELSE
    -- Create new household
    INSERT INTO public.households (name) VALUES ('My Household')
    RETURNING id INTO new_household_id;
  END IF;

  INSERT INTO public.profiles (user_id, household_id, display_name)
  VALUES (NEW.id, new_household_id, NEW.raw_user_meta_data ->> 'display_name');

  RETURN NEW;
END;
$$;
