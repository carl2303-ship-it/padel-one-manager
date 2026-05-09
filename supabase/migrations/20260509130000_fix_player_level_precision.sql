-- Fix: player_accounts.level was numeric(3,1) — only 1 decimal place
-- Ratings like 4.81 were truncated to 4.8
-- Change to numeric(5,2) to support 2 decimal places

-- Must drop trigger first (depends on the column)
DROP TRIGGER IF EXISTS trg_auto_player_category ON player_accounts;

ALTER TABLE player_accounts ALTER COLUMN level TYPE numeric(5,2);

-- Recreate the trigger
CREATE TRIGGER trg_auto_player_category
BEFORE UPDATE OF level ON player_accounts
FOR EACH ROW
EXECUTE FUNCTION auto_set_player_category();

NOTIFY pgrst, 'reload schema';
