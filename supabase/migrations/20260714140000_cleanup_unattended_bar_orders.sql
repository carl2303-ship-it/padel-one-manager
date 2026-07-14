-- Auto-delete club_orders that were never attended (status = pending) after 60 minutes.
-- club_order_items are removed via ON DELETE CASCADE.

CREATE OR REPLACE FUNCTION cleanup_unattended_club_orders(p_max_age_minutes int DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM club_orders
    WHERE status = 'pending'
      AND created_at < now() - make_interval(mins => p_max_age_minutes)
    RETURNING id
  )
  SELECT count(*)::integer INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_unattended_club_orders(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_unattended_club_orders(int) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_unattended_club_orders(int) TO service_role;

-- Schedule cleanup every 5 minutes (pg_cron already enabled in prior migrations)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-unattended-club-orders');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'cleanup-unattended-club-orders',
  '*/5 * * * *',
  $$SELECT cleanup_unattended_club_orders(60)$$
);
