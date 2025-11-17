-- Create table for public membership inquiries (no auth required)
CREATE TABLE IF NOT EXISTS membership_inquiries (
  id bigint primary key generated always as identity,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  submitted_at timestamptz default now(),
  is_read boolean default false,
  is_resolved boolean default false,
  admin_notes text
);

-- Enable RLS
ALTER TABLE membership_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow public insert (for non-authenticated users)
CREATE POLICY "Allow public insert" ON membership_inquiries
  FOR INSERT
  WITH CHECK (true);

-- Allow admins to read all inquiries
CREATE POLICY "Allow admins to read" ON membership_inquiries
  FOR SELECT
  USING (true);

-- Allow admins to update inquiries
CREATE POLICY "Allow admins to update" ON membership_inquiries
  FOR UPDATE
  USING (true);

-- Allow admins to delete inquiries
CREATE POLICY "Allow admins to delete" ON membership_inquiries
  FOR DELETE
  USING (true);
