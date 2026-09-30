CREATE TABLE IF NOT EXISTS gestures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binary_code text UNIQUE NOT NULL CHECK (binary_code ~ '^[01]{5}$'),
  phrase text NOT NULL CHECK (length(phrase) > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gestures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view gestures"
  ON gestures
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert gestures"
  ON gestures
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update gestures"
  ON gestures
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete gestures"
  ON gestures
  FOR DELETE
  TO anon
  USING (true);

-- Insert default gestures
INSERT INTO gestures (binary_code, phrase) VALUES
  ('00000', 'Hello'),
  ('10000', 'How are you'),
  ('01000', 'I am fine'),
  ('11000', 'Thank you'),
  ('10100', 'Can you help me'),
  ('11111', 'Good morning'),
  ('00011', 'Good night')
ON CONFLICT (binary_code) DO NOTHING;