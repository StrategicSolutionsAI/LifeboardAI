-- Create weight_measurements table for storing weight data from Withings
-- Kept consistent with existing uuid generation approach
CREATE TABLE IF NOT EXISTS public.weight_measurements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg DECIMAL(5,2) NOT NULL,
  weight_lbs DECIMAL(5,2) NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'withings',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weight_measurements_user_id ON public.weight_measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_measurements_measured_at ON public.weight_measurements(measured_at);
CREATE INDEX IF NOT EXISTS idx_weight_measurements_user_measured ON public.weight_measurements(user_id, measured_at DESC);

-- Enable Row Level Security
ALTER TABLE public.weight_measurements ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'weight_measurements' AND policyname = 'Users can view their own weight measurements'
  ) THEN
    CREATE POLICY "Users can view their own weight measurements" ON public.weight_measurements
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'weight_measurements' AND policyname = 'Users can insert their own weight measurements'
  ) THEN
    CREATE POLICY "Users can insert their own weight measurements" ON public.weight_measurements
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'weight_measurements' AND policyname = 'Users can update their own weight measurements'
  ) THEN
    CREATE POLICY "Users can update their own weight measurements" ON public.weight_measurements
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'weight_measurements' AND policyname = 'Users can delete their own weight measurements'
  ) THEN
    CREATE POLICY "Users can delete their own weight measurements" ON public.weight_measurements
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_weight_measurements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_weight_measurements_updated_at ON public.weight_measurements;
CREATE TRIGGER update_weight_measurements_updated_at
  BEFORE UPDATE ON public.weight_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_weight_measurements_updated_at();

