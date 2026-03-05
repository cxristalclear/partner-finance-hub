-- Create households table for partner linking
CREATE TABLE public.households (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Household',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create bank_connections table for Plaid tokens
CREATE TABLE public.bank_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL,
  institution_id TEXT,
  item_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  cursor TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

-- Create account_balances table for cached balances
CREATE TABLE public.account_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  available_balance NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user belongs to household
CREATE OR REPLACE FUNCTION public.user_household_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.profiles WHERE user_id = _user_id
$$;

-- Households policies
CREATE POLICY "Members can view their household"
  ON public.households FOR SELECT
  USING (id = public.user_household_id(auth.uid()));

-- Profiles policies
CREATE POLICY "Users can view household members"
  ON public.profiles FOR SELECT
  USING (household_id = public.user_household_id(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Bank connections policies
CREATE POLICY "Household members can view bank connections"
  ON public.bank_connections FOR SELECT
  USING (household_id = public.user_household_id(auth.uid()));

CREATE POLICY "Users can insert own bank connections"
  ON public.bank_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Account balances policies
CREATE POLICY "Household members can view balances"
  ON public.account_balances FOR SELECT
  USING (
    bank_connection_id IN (
      SELECT id FROM public.bank_connections
      WHERE household_id = public.user_household_id(auth.uid())
    )
  );

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_household_id UUID;
BEGIN
  INSERT INTO public.households (name) VALUES ('My Household')
  RETURNING id INTO new_household_id;
  
  INSERT INTO public.profiles (user_id, household_id, display_name)
  VALUES (NEW.id, new_household_id, NEW.raw_user_meta_data ->> 'display_name');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();