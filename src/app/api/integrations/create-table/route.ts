import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role key for DDL
    );
    
    // Create the user_integrations table
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: `
        -- Create extension if it doesn't exist
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        
        -- Create the user_integrations table if it doesn't exist
        CREATE TABLE IF NOT EXISTS public.user_integrations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          provider VARCHAR(255) NOT NULL,
          access_token TEXT,
          refresh_token TEXT,
          token_data JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, provider)
        );
        
        -- Add RLS policies
        ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
        
        DO $$
        BEGIN
          -- Check if policies exist before creating them
          IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_policies 
            WHERE tablename = 'user_integrations' AND policyname = 'Users can view their own integrations'
          ) THEN
            -- Users can read their own integrations
            CREATE POLICY "Users can view their own integrations" ON public.user_integrations
              FOR SELECT USING (auth.uid() = user_id);
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_policies 
            WHERE tablename = 'user_integrations' AND policyname = 'Users can insert their own integrations'
          ) THEN
            -- Users can insert their own integrations
            CREATE POLICY "Users can insert their own integrations" ON public.user_integrations
              FOR INSERT WITH CHECK (auth.uid() = user_id);
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_policies 
            WHERE tablename = 'user_integrations' AND policyname = 'Users can update their own integrations'
          ) THEN
            -- Users can update their own integrations
            CREATE POLICY "Users can update their own integrations" ON public.user_integrations
              FOR UPDATE USING (auth.uid() = user_id);
          END IF;
        END $$;
        
        -- Add indices for better query performance if they don't exist
        CREATE INDEX IF NOT EXISTS user_integrations_user_id_idx ON public.user_integrations (user_id);
        CREATE INDEX IF NOT EXISTS user_integrations_provider_idx ON public.user_integrations (provider);
      `
    });

    if (error) {
      console.error('Error creating table:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in create table endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
