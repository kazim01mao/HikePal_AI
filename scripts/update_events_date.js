import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateEvents() {
  const { data, error } = await supabase
    .from('events')
    .update({ event_date: '2026-07-01' })
    .not('id', 'is', null);

  if (error) {
    console.error('Error updating events:', error);
  } else {
    console.log('Successfully updated all events to 2026-07-01:', data);
  }
}

updateEvents();
