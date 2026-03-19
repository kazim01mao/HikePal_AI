// scripts/simulate_teammates.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Read .env.local manually to get keys
const envPath = path.resolve(__dirname, '../.env.local');
let supabaseUrl, supabaseKey;

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (!key) return;
    const value = rest.join('=').trim();
    if (key.trim() === 'VITE_SUPABASE_URL') supabaseUrl = value;
    if (key.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value;
  });
} catch (e) {
  console.error('Error reading .env.local:', e.message);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

console.log('✅ Connected to Supabase:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

// Get Session ID from command line or default
const SESSION_ID = process.argv[2];

if (!SESSION_ID) {
  console.error('⚠️  Please provide a SESSION_ID');
  console.log('   Usage: node scripts/simulate_teammates.js <SESSION_ID>');
  process.exit(1);
}

console.log(`\n🚀 Starting simulation for Session ID: "${SESSION_ID}"`);
console.log('   Simulating 3 teammates moving near Dragon\'s Back...');
console.log('   Press Ctrl+C to stop.\n');

// Initial positions (near Dragon's Back)
const teammates = [
  { id: 'sim_alice', name: 'Alice (Sim)', lat: 22.235, lng: 114.243 },
  { id: 'sim_bob', name: 'Bob (Sim)', lat: 22.234, lng: 114.242 },
  { id: 'sim_charlie', name: 'Charlie (Sim)', lat: 22.236, lng: 114.244 },
];

async function updateLocations() {
  const updates = teammates.map(t => {
    // Move randomly slightly (simulate walking)
    // ~0.0001 degrees is roughly 10 meters
    t.lat += (Math.random() - 0.45) * 0.00015; 
    t.lng += (Math.random() - 0.5) * 0.00015;

    return {
      session_id: SESSION_ID,
      user_id: t.id,
      latitude: t.lat,
      longitude: t.lng,
      // created_at defaults to now() in DB
    };
  });

  const { error } = await supabase.from('locations').insert(updates);

  if (error) {
    console.error('❌ Error updating locations:', error.message);
  } else {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] 📍 Updated locations for ${updates.length} hikers`);
    updates.forEach((u, i) => {
        console.log(`   - ${teammates[i].name}: [${u.latitude.toFixed(5)}, ${u.longitude.toFixed(5)}]`);
    });
  }
}

// Run immediately then loop
updateLocations();
setInterval(updateLocations, 3000); // Update every 3 seconds
