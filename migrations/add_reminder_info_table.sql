-- Migration for reminder_info table

CREATE TABLE IF NOT EXISTS public.reminder_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id TEXT NOT NULL, -- To match with Route ID (e.g., 'hk1', 'hk8')
    type TEXT NOT NULL, -- e.g., 'risk', 'facility', 'info'
    name TEXT NOT NULL, -- e.g., 'Slippery Rocks', 'Public Toilet'
    description TEXT, -- Detailed description to show to user
    ai_prompt TEXT, -- Specific prompt text for the AI Guide auto-alert
    coordinates JSONB NOT NULL, -- Format: [latitude, longitude]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Row Level Security (RLS) policies
ALTER TABLE public.reminder_info ENABLE ROW LEVEL SECURITY;

-- Allow read access for all authenticated users
CREATE POLICY "Allow public read access on reminder_info" ON public.reminder_info
    FOR SELECT USING (true);

-- Optional: Allow insert/update/delete for admins or specific roles if needed
-- (Assuming public shouldn't edit these official reminders, so no public INSERT policy by default)

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reminder_info_modtime
    BEFORE UPDATE ON public.reminder_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some mock data for Dragon's Back (hk8) and other routes for testing
INSERT INTO public.reminder_info (route_id, type, name, description, ai_prompt, coordinates)
VALUES 
('hk8', 'risk', 'Steep Descent', 'Very steep and rocky section ahead.', '⚠️ Be careful! The path ahead has a very steep descent with loose rocks. Watch your step.', '[22.235, 114.240]'),
('hk8', 'facility', 'Pavilion', 'A shaded pavilion with seating.', 'ℹ️ There is a pavilion nearby if you need to rest and hydrate.', '[22.238, 114.242]'),
('hk1', 'facility', 'Public Toilet', 'Clean public toilet near the peak.', 'ℹ️ There is a public restroom nearby.', '[22.270, 114.150]')
ON CONFLICT DO NOTHING;
