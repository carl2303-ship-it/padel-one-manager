/*
  # Backfill is_managed for existing clubs

  The is_managed column was added with DEFAULT false, which incorrectly marked
  all existing clubs (that have an owner) as unmanaged placeholders.
  This sets is_managed = true for every club that already has an owner_id.
*/

UPDATE clubs SET is_managed = true WHERE owner_id IS NOT NULL AND is_managed = false;
