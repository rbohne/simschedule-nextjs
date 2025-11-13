-- Add active_until column to profiles table for membership tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_until TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the column
COMMENT ON COLUMN profiles.active_until IS 'Date until which the user has active membership (1 year from payment)';
