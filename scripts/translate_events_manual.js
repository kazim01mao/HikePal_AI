import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndTranslateEvents() {
  const { data: events, error } = await supabase.from('events').select('*');
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }

  // Pre-translated mappings based on the text fetched in the error
  const translations = {
      // 9a8eff6d-1080-4f8a-a5a4-370335b04532
      "这不仅是一次徒步，更是一次大地艺术创作！我们将穿梭于港岛的城市步道与山径之间，在GPS地图上“画”出一只巨大的恐龙。适合喜欢摄影和创意社交的朋友。": "This is not just a hike, but a creation of land art! We will weave through the urban paths and trails of Hong Kong Island to 'draw' a giant dinosaur on the GPS map. Perfect for those who love photography and creative socializing.",
      
      // 55439330-ec5a-46cd-8c88-44fb97bcfb8a
      "让我们一起行动，在享受Dragon's Back美景的同时，清理山径垃圾，保护自然环境。提供清洁工具。": "Let's take action together! While enjoying the beautiful scenery of Dragon's Back, we will clear trash from the trails and protect the natural environment. Cleaning tools will be provided.",
      
      // c8a19b4d-97e9-49bc-879c-21a7f19dad22
      "金督驰马径是港岛俯瞰九龙半岛与维港的最佳机位之一。本次Event鼓励大家携带个人相机（单反、微单或手机均可），在日落时分捕捉最美海景。": "Sir Cecil's Ride is one of the best spots on Hong Kong Island overlooking the Kowloon Peninsula and Victoria Harbour. This event encourages everyone to bring their personal cameras (DSLR, mirrorless, or smartphone) to capture the most beautiful sea views at sunset.",
      
      // other potential fields
      "港岛画恐龙": "Hong Kong Island Dinosaur Drawing"
  };

  for (const event of events) {
    let newTitle = event.title;
    let newDescription = event.description;
    let newLocation = event.location;
    let newLocationName = event.location_name;

    // Additional generic location translations
    const locationTranslations = {
      '宝马山': "Braemar Hill",
      '港岛东': "Hong Kong Island East",
      '港岛区': "Hong Kong Island",
      '石澳': "Shek O",
      '大屿山': "Lantau",
      '西贡': "Sai Kung",
      '太平山': "The Peak",
      '香港': "Hong Kong"
    };

    const allTranslations = { ...translations, ...locationTranslations };

    // Apply translations
    for (const [cn, en] of Object.entries(allTranslations)) {
        if (newTitle && newTitle.includes(cn)) newTitle = newTitle.replace(cn, en);
        if (newDescription && newDescription.includes(cn)) newDescription = newDescription.replace(cn, en);
        if (newLocation && newLocation.includes(cn)) newLocation = newLocation.replace(cn, en);
        if (newLocationName && newLocationName.includes(cn)) newLocationName = newLocationName.replace(cn, en);
    }
    
    if (newTitle !== event.title || newDescription !== event.description || newLocation !== event.location || newLocationName !== event.location_name) {
      console.log(`Updating event ID: ${event.id}`);
      
      const { error: updateError } = await supabase
        .from('events')
        .update({ title: newTitle, description: newDescription, location: newLocation, location_name: newLocationName })
        .eq('id', event.id);
        
      if (updateError) {
        console.error(`Failed to update event ${event.id}:`, updateError);
      } else {
        console.log(`Successfully updated event ${event.id}`);
      }
    }
  }
}

checkAndTranslateEvents().catch(console.error);