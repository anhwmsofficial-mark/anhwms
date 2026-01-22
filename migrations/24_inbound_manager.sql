-- Add inbound_manager column to inbound_plans
ALTER TABLE inbound_plans
  ADD COLUMN IF NOT EXISTS inbound_manager text;
