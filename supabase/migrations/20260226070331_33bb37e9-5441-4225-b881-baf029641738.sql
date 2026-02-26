
-- Add file_names column to store uploaded file names
ALTER TABLE public.generated_papers ADD COLUMN IF NOT EXISTS file_names jsonb DEFAULT '[]'::jsonb;

-- Make user_id nullable for no-auth prototype
ALTER TABLE public.generated_papers ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing restrictive RLS policies
DROP POLICY IF EXISTS "Users can view own papers" ON public.generated_papers;
DROP POLICY IF EXISTS "Users can insert own papers" ON public.generated_papers;
DROP POLICY IF EXISTS "Users can update own papers" ON public.generated_papers;
DROP POLICY IF EXISTS "Users can delete own papers" ON public.generated_papers;

-- Create permissive public policies for prototype
CREATE POLICY "Public read access" ON public.generated_papers FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON public.generated_papers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete access" ON public.generated_papers FOR DELETE USING (true);
