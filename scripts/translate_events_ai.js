import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const apiKey = process.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function translateText(text) {
  if (!text) return text;
  
  // If it doesn't contain any Chinese characters, skip translation
  if (!/[\u4e00-\u9fa5]/.test(text)) {
      return text;
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const prompt = `Translate the following text from Chinese to English. Only output the English translation, nothing else.\n\nText: ${text}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error(`Failed to translate: ${text}`, error);
    return text;
  }
}

async function translateEvents() {
  const { data: events, error } = await supabase.from('events').select('*');
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }
  
  console.log(`Found ${events.length} events to check for translation.`);

  for (const event of events) {
    let newTitle = event.title;
    let newDescription = event.description;
    let newLocation = event.location;
    let newLocationName = event.location_name;

    // Use Gemini to translate fields
    newTitle = await translateText(event.title);
    newDescription = await translateText(event.description);
    newLocation = await translateText(event.location);
    newLocationName = await translateText(event.location_name);

    if (newTitle !== event.title || newDescription !== event.description || newLocation !== event.location || newLocationName !== event.location_name) {
      console.log(`Updating event ID: ${event.id}`);
      console.log(`Old Title: ${event.title} -> New Title: ${newTitle}`);
      console.log(`Old Location: ${event.location} -> New Location: ${newLocation}`);
      console.log(`Old Location Name: ${event.location_name} -> New Location Name: ${newLocationName}`);
      
      const { error: updateError } = await supabase
        .from('events')
        .update({ 
          title: newTitle, 
          description: newDescription, 
          location: newLocation,
          location_name: newLocationName
        })
        .eq('id', event.id);
        
      if (updateError) {
        console.error(`Failed to update event ${event.id}:`, updateError);
      } else {
        console.log(`Successfully updated event ${event.id}`);
      }
    } else {
      console.log(`No translation needed for event ID: ${event.id}`);
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
}

translateEvents().catch(console.error);