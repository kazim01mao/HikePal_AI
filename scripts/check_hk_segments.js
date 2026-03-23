import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkHKTrailSegments() {
  const HK_TRAIL_ID = 'e0ff692e-0028-4eb0-9aef-9cf56624093f';
  
  console.log(`--- Checking segments for HK Trail (${HK_TRAIL_ID}) ---`);
  
  const { data: connections, error: connError } = await supabase
    .from('official_connection_backend')
    .select('*')
    .eq('route_id', HK_TRAIL_ID)
    .order('sort_order', { ascending: true });

  if (connError) {
    console.error('Error fetching connections:', connError);
    return;
  }

  console.log(`Found ${connections.length} segment connections.`);

  for (const conn of connections) {
    const { data: segment, error: segError } = await supabase
      .from('segments_backend')
      .select('id, name, coordinates')
      .eq('id', conn.segment_id)
      .single();

    if (segError) {
      console.error(`Error fetching segment ${conn.segment_id}:`, segError);
      continue;
    }

    let coords = segment.coordinates;
    if (typeof coords === 'string') coords = JSON.parse(coords);
    const coordCount = coords.coordinates ? coords.coordinates.length : (Array.isArray(coords) ? coords.length : 0);
    
    console.log(`Order: ${conn.sort_order} | Segment: ${segment.name} | Coords: ${coordCount}`);
  }
}

checkHKTrailSegments();
