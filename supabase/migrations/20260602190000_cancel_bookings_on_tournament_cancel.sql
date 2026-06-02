-- When a tournament is cancelled, automatically cancel all its court bookings
CREATE OR REPLACE FUNCTION cancel_tournament_bookings()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE court_bookings
    SET status = 'cancelled'
    WHERE tournament_id = NEW.id
      AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cancel_bookings_on_tournament_cancel ON tournaments;

CREATE TRIGGER trg_cancel_bookings_on_tournament_cancel
  AFTER UPDATE OF status ON tournaments
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION cancel_tournament_bookings();
