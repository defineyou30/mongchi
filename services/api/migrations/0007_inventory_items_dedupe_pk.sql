BEGIN;

-- Collapse any duplicate (user_id, item_id) rows that slipped in under the old
-- composite primary key (user_id, item_id, source, acquired_at). A race
-- between two concurrent ensureInventory/upsertInventory calls for the same
-- new user could each insert a starter row for the same item with a
-- different acquired_at/source, producing two rows for one itemId. Keep a
-- single row per (user_id, item_id) with quantity summed across duplicates,
-- the earliest acquired_at, and source preferring 'starter' (falls back to
-- the earliest-acquired row's source otherwise).
CREATE TEMP TABLE inventory_items_deduped ON COMMIT DROP AS
SELECT DISTINCT ON (user_id, item_id)
  user_id,
  item_id,
  SUM(quantity) OVER (PARTITION BY user_id, item_id) AS quantity,
  FIRST_VALUE(acquired_at) OVER (
    PARTITION BY user_id, item_id
    ORDER BY acquired_at ASC
  ) AS acquired_at,
  FIRST_VALUE(source) OVER (
    PARTITION BY user_id, item_id
    ORDER BY (source = 'starter') DESC, acquired_at ASC
  ) AS source
FROM public.inventory_items
ORDER BY user_id, item_id;

DELETE FROM public.inventory_items;

INSERT INTO public.inventory_items (user_id, item_id, quantity, acquired_at, source)
SELECT user_id, item_id, quantity, acquired_at, source
FROM inventory_items_deduped;

ALTER TABLE public.inventory_items
  DROP CONSTRAINT inventory_items_pkey;

ALTER TABLE public.inventory_items
  ADD PRIMARY KEY (user_id, item_id);

COMMIT;
