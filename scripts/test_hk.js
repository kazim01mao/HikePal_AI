import 'dotenv/config';
import { fetchAllRoutesFromDB } from '../services/segmentRoutingService.js';

async function test() {
  const routes = await fetchAllRoutesFromDB();
  const hk = routes.find(r => r.id === 'e0ff692e-0028-4eb0-9aef-9cf56624093f');
  console.log("Found HK Trail:", hk ? true : false);
  if (hk) {
    console.log("distance:", hk.total_distance);
    console.log("duration:", hk.total_duration_minutes);
    console.log("elevation:", hk.total_elevation_gain);
    console.log("segments count:", hk.segments.length);
    console.log("coordinates count:", hk.full_coordinates?.length);
  }
}

test();