import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function translateEvents() {
  const { data: events, error } = await supabase.from('events').select('*');
  if (error) {
    if (error.code === '42P01') {
       console.log("No events table found yet. Will skip translation for now and focus on frontend implementation.");
       return;
    }
    console.error('Error fetching events:', error);
    return;
  }
  
  console.log(`Found ${events.length} events.`);

  for (const event of events) {
    let newTitle = event.title;
    let newDescription = event.description;
    let newLocation = event.location;

    // Simple mapping for common Chinese terms to English based on typical hike events
    const translations = {
      '清径行动': 'Trail Cleanup',
      '龙脊': "Dragon's Back",
      '修路行动': 'Trail Maintenance',
      '大屿山': 'Lantau Peak',
      '丝带标记行动': 'Ribbon Placement Guide',
      '西贡': 'Sai Kung',
      '石澳': 'Shek O',
      '大东山': 'Sunset Peak',
      '清理垃圾': 'Garbage Cleanup',
      '植树': 'Tree Planting',
      '导赏团': 'Guided Tour',
      '周末': 'Weekend',
      '远足': 'Hiking',
      '活动': 'Event'
    };

    if (newTitle) {
      for (const [cn, en] of Object.entries(translations)) {
        newTitle = newTitle.replace(new RegExp(cn, 'g'), en);
      }
    }
    
    if (newDescription) {
      for (const [cn, en] of Object.entries(translations)) {
        newDescription = newDescription.replace(new RegExp(cn, 'g'), en);
      }
    }

    if (newLocation) {
      for (const [cn, en] of Object.entries(translations)) {
        newLocation = newLocation.replace(new RegExp(cn, 'g'), en);
      }
    }
    
    if (newTitle !== event.title || newDescription !== event.description || newLocation !== event.location) {
      console.log(`Updating event ID: ${event.id}`);
      console.log(`Old Title: ${event.title} -> New Title: ${newTitle}`);
      const { error: updateError } = await supabase
        .from('events')
        .update({ title: newTitle, description: newDescription, location: newLocation })
        .eq('id', event.id);
        
      if (updateError) {
        console.error(`Failed to update event ${event.id}:`, updateError);
      } else {
        console.log(`Successfully updated event ${event.id}`);
      }
    }
  }
}

translateEvents().catch(console.error);