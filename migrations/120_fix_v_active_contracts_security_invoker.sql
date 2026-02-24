-- Fix security advisory: SECURITY DEFINER view
-- Apply invoker permissions so RLS is evaluated with querying user context.
ALTER VIEW public.v_active_contracts
  SET (security_invoker = true);
