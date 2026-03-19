import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReminderInfo() {
  const { data, error } = await supabase.from('reminder_info').select('*').limit(1);
  if (error) {
    console.error('Error fetching reminder_info:', error);
  } else {
    console.log('Sample row from reminder_info:');
    console.log(JSON.stringify(data[0] || {}, null, 2));
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
    } else {
      console.log('Table is empty. Cannot determine columns directly without schema query.');
    }
  }
}

checkReminderInfo();
