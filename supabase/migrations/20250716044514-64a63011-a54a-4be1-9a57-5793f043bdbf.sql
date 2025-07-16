-- Fix critical security vulnerabilities in database functions

-- Update handle_new_user function with proper security
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Update mark_previous_freight_as_outdated function with proper security
CREATE OR REPLACE FUNCTION public.mark_previous_freight_as_outdated()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Marcar cálculos anteriores do mesmo produto/CEP como não-atuais
  UPDATE public.freight_history 
  SET is_current = false 
  WHERE user_id = NEW.user_id 
    AND product_id = NEW.product_id 
    AND zip_code = NEW.zip_code 
    AND id != NEW.id;
  
  RETURN NEW;
END;
$$;

-- Improve RLS policies to be more restrictive
DROP POLICY IF EXISTS "Users can create their own last calculations" ON public.user_last_calculations;
CREATE POLICY "Users can create their own last calculations" 
ON public.user_last_calculations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id AND id IS NOT NULL);

-- Add DELETE policies for security
CREATE POLICY "Users can delete their own freight history" 
ON public.freight_history 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);

CREATE POLICY "Users can delete their own settings" 
ON public.user_settings 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own last calculations" 
ON public.user_last_calculations 
FOR DELETE 
USING (auth.uid() = user_id);