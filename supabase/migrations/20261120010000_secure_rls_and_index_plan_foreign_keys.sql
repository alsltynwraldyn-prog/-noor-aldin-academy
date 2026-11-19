-- ORVEXAL production hardening migration
-- Applied to Supabase project ARVYQEN.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;

ALTER POLICY profiles_select_own ON public.profiles
  USING ((select auth.uid()) = id);
ALTER POLICY profiles_insert_own ON public.profiles
  WITH CHECK ((select auth.uid()) = id);
ALTER POLICY profiles_update_own ON public.profiles
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);
ALTER POLICY orders_select_own ON public.orders
  USING ((select auth.uid()) = user_id);
ALTER POLICY subscriptions_select_own ON public.subscriptions
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS orders_plan_id_idx
  ON public.orders(plan_id);
CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx
  ON public.subscriptions(plan_id);
