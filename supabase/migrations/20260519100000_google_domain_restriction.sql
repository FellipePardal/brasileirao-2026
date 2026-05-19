-- Update trigger to block non-livemode Google OAuth accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Block OAuth signups from outside @livemode.com
  IF NEW.raw_app_meta_data->>'provider' != 'email'
     AND NEW.email NOT LIKE '%@livemode.com' THEN
    RAISE EXCEPTION 'Access restricted to @livemode.com accounts';
  END IF;

  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'visualizador')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
