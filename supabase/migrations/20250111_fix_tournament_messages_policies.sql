-- Drop the existing select policy that only allows viewing active messages
DROP POLICY IF EXISTS "Anyone can view active tournament messages" ON tournament_messages;

-- Create new policy: Anyone can view active messages
CREATE POLICY "Anyone can view active tournament messages"
  ON tournament_messages
  FOR SELECT
  USING (is_active = true);

-- Create new policy: Admins can view all messages (active and inactive)
CREATE POLICY "Admins can view all tournament messages"
  ON tournament_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
