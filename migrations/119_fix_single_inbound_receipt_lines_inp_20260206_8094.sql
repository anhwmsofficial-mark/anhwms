-- Single-case data fix for INP-20260206-8094 (planned_date: 2026-02-06)
-- Purpose:
-- 1) Remove stale receipt lines pointing to old/non-current plan_line_id
-- 2) Remove duplicate receipt lines per plan_line_id (keep latest one)

WITH target AS (
  SELECT
    p.id AS plan_id,
    r.id AS receipt_id
  FROM inbound_plans p
  JOIN inbound_receipts r
    ON r.plan_id = p.id
  WHERE p.plan_no = 'INP-20260206-8094'
    AND p.planned_date = DATE '2026-02-06'
),
valid_plan_lines AS (
  SELECT pl.id
  FROM inbound_plan_lines pl
  JOIN target t ON t.plan_id = pl.plan_id
),
stale_rows AS (
  SELECT rl.id
  FROM inbound_receipt_lines rl
  JOIN target t ON t.receipt_id = rl.receipt_id
  LEFT JOIN valid_plan_lines vpl ON vpl.id = rl.plan_line_id
  WHERE rl.plan_line_id IS NULL OR vpl.id IS NULL
),
dupe_rank AS (
  SELECT
    rl.id,
    ROW_NUMBER() OVER (
      PARTITION BY rl.plan_line_id
      ORDER BY rl.updated_at DESC NULLS LAST, rl.created_at DESC NULLS LAST, rl.id DESC
    ) AS rn
  FROM inbound_receipt_lines rl
  JOIN target t ON t.receipt_id = rl.receipt_id
  WHERE rl.plan_line_id IN (SELECT id FROM valid_plan_lines)
),
dupe_rows AS (
  SELECT id
  FROM dupe_rank
  WHERE rn > 1
),
to_delete AS (
  SELECT id FROM stale_rows
  UNION
  SELECT id FROM dupe_rows
)
DELETE FROM inbound_receipt_lines
WHERE id IN (SELECT id FROM to_delete);
