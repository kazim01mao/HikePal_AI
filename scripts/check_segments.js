import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('segments_backend').select('id, name, distance_km, coordinates').limit(2);
  console.log("Segments:");
  data.forEach(d => {
    let coords = typeof d.coordinates === 'string' ? JSON.parse(d.coordinates) : d.coordinates;
    let actualCoords = coords.coordinates || coords;
    console.log(d.name, "distance:", d.distance_km, "coords count:", actualCoords?.length);
  });
}
check();