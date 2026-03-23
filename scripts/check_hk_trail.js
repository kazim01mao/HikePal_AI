import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function inspectTables() {
  console.log('--- Inspecting Columns in official_connection_backend ---');
  const { data: connections, error: connError } = await supabase
    .from('official_connection_backend')
    .select('*')
    .limit(1);

  if (connError) {
    console.error('Error fetching connection sample:', connError);
  } else {
    console.log('Connection Columns:', Object.keys(connections[0] || {}));
    console.log('Connection Sample Data:', connections[0]);
  }

  console.log('\n--- Inspecting Hong Kong Trail in official_trails_backend ---');
  const { data: trails, error: trailError } = await supabase
    .from('official_trails_backend')
    .select('*')
    .ilike('name', '%Hong Kong Trail%');

  if (trailError) {
    console.error('Error fetching trails:', trailError);
  } else if (trails.length > 0) {
    const trail = trails[0];
    console.log(`Trail Name: ${trail.name}`);
    console.log(`Trail ID: ${trail.id}`);
    console.log(`Coordinates type: ${typeof trail.coordinates}`);
    console.log(`Coordinates value (stringified): ${JSON.stringify(trail.coordinates).slice(0, 300)}...`);
  } else {
    console.log('No Hong Kong Trail found.');
  }
}

inspectTables();
