-- Add company_name column for business profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
