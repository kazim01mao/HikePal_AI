import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
  console.log('Testing RPC get_reminder_with_coords...');
  const { data, error } = await supabase.rpc('get_reminder_with_coords');
  
  if (error) {
    console.error('❌ RPC Error:', error.message);
    if (error.message.includes('does not exist')) {
        console.log('💡 The RPC "get_reminder_with_coords" does NOT exist in your Supabase project.');
    }
  } else {
    console.log('✅ RPC works! Loaded reminders:', data?.length || 0);
  }
}

checkRpc();
