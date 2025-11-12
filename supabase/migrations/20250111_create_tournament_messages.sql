-- Create tournament_messages table
CREATE TABLE IF NOT EXISTS tournament_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE tournament_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active messages
CREATE POLICY "Anyone can view active tournament messages"
  ON tournament_messages
  FOR SELECT
  USING (is_active = true);

-- Policy: Admins can insert messages
CREATE POLICY "Admins can insert tournament messages"
  ON tournament_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update messages
CREATE POLICY "Admins can update tournament messages"
  ON tournament_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can delete messages
CREATE POLICY "Admins can delete tournament messages"
  ON tournament_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for better performance
CREATE INDEX idx_tournament_messages_active ON tournament_messages(is_active);
CREATE INDEX idx_tournament_messages_created_at ON tournament_messages(created_at DESC);
