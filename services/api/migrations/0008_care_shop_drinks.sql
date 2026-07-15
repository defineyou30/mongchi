BEGIN;

UPDATE public.items
SET category = 'drink',
    behavior_tags = '["drink", "hydrate", "premium"]'::jsonb,
    updated_at = now()
WHERE id = 'item_milk_pup_cup'
  AND (
    category IS DISTINCT FROM 'drink'
    OR behavior_tags IS DISTINCT FROM '["drink", "hydrate", "premium"]'::jsonb
  );

COMMIT;
