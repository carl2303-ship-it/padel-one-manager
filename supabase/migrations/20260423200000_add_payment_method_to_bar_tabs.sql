ALTER TABLE bar_tabs
  ADD COLUMN IF NOT EXISTS payment_method text
  CHECK (payment_method IN ('cash', 'card'));
