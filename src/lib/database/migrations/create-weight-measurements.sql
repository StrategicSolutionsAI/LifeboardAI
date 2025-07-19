-- Create weight_measurements table for storing weight data from Withings
CREATE TABLE IF NOT EXISTS weight_measurements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg DECIMAL(5,2) NOT NULL,
  weight_lbs DECIMAL(5,2) NOT NULL,
  measured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'withings',
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_weight_measurements_user_id ON weight_measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_measurements_measured_at ON weight_measurements(measured_at);
CREATE INDEX IF NOT EXISTS idx_weight_measurements_user_measured ON weight_measurements(user_id, measured_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE weight_measurements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own weight measurements" ON weight_measurements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight measurements" ON weight_measurements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weight measurements" ON weight_measurements
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weight measurements" ON weight_measurements
  FOR DELETE USING (auth.uid() = user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_weight_measurements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_weight_measurements_updated_at
  BEFORE UPDATE ON weight_measurements
  FOR EACH ROW
  EXECUTE FUNCTION update_weight_measurements_updated_at();
