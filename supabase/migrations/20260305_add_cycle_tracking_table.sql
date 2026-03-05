-- Menstrual cycle tracking table
CREATE TABLE IF NOT EXISTS cycle_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  flow_intensity TEXT NOT NULL DEFAULT 'none' CHECK (flow_intensity IN ('none', 'light', 'medium', 'heavy')),
  symptoms JSONB DEFAULT '[]'::jsonb,
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  notes TEXT,
  period_start BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (user_id, date)
);

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_cycle_tracking_user_date ON cycle_tracking (user_id, date DESC);

-- RLS
ALTER TABLE cycle_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own cycle data"
  ON cycle_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cycle data"
  ON cycle_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cycle data"
  ON cycle_tracking FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cycle data"
  ON cycle_tracking FOR DELETE
  USING (auth.uid() = user_id);
