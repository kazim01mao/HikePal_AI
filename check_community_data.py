import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

print("🔍 Checking community routes data...")
print(f"Supabase URL: {SUPABASE_URL}")
print(f"Supabase Key: {SUPABASE_KEY[:20]}...")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_community_routes():
    """Check community routes data in database"""
    print("\n1. Fetching uploaded routes from database...")
    
    try:
        # Fetch uploaded routes
        response = supabase.table('uploaded_routes') \
            .select('*') \
            .eq('is_published', True) \
            .order('created_at', {'ascending': False}) \
            .limit(10) \
            .execute()
        
        data = response.data
        print(f"✅ Found {len(data)} community routes")
        
        if len(data) == 0:
            print("❌ No community routes found in database")
            return
        
        # Analyze each route
        for i, route in enumerate(data):
            print(f"\n--- Route {i+1}: {route.get('name')} ---")
            print(f"ID: {route.get('id')}")
            print(f"User ID: {route.get('user_id')}")
            print(f"Created at: {route.get('created_at')}")
            
            # Check route_data
            route_data = route.get('route_data', {})
            if isinstance(route_data, str):
                try:
                    route_data = json.loads(route_data)
                except:
                    route_data = {}
            
            print(f"Route data type: {type(route_data)}")
            print(f"Route data keys: {list(route_data.keys()) if isinstance(route_data, dict) else 'N/A'}")
            
            # Check for image URL in route_data
            image_url = None
            if isinstance(route_data, dict):
                image_url = route_data.get('imageUrl') or \
                           route_data.get('cover_url') or \
                           route_data.get('cover_image')
            
            # Check waypoints for images
            waypoints = []
            if isinstance(route_data, dict) and 'waypoints' in route_data:
                waypoints = route_data['waypoints']
                if isinstance(waypoints, str):
                    try:
                        waypoints = json.loads(waypoints)
                    except:
                        waypoints = []
                
                # Look for images in waypoints
                if isinstance(waypoints, list):
                    for wp in waypoints:
                        if isinstance(wp, dict) and wp.get('imageUrl'):
                            image_url = wp.get('imageUrl')
                            print(f"Found image in waypoint: {image_url}")
                            break
            
            print(f"Image URL found: {'✅' if image_url else '❌'}")
            if image_url:
                print(f"Image URL: {image_url}")
            
            # Check waypoints count
            if isinstance(waypoints, list):
                print(f"Waypoints: {len(waypoints)}")
                for j, wp in enumerate(waypoints[:3]):  # Show first 3 waypoints
                    if isinstance(wp, dict):
                        print(f"  Waypoint {j+1}: {wp.get('note', 'No note')}")
                        if wp.get('imageUrl'):
                            print(f"    Has image: ✅")
                        if wp.get('lat') and wp.get('lng'):
                            print(f"    Location: {wp.get('lat')}, {wp.get('lng')}")
            
            # Check tags
            tags = route.get('tags')
            if tags:
                if isinstance(tags, str):
                    try:
                        tags = json.loads(tags)
                    except:
                        tags = []
                print(f"Tags: {tags}")
        
        print("\n2. Testing image URL extraction logic...")
        print("The fetchUploadedRoutes function now extracts image URLs from:")
        print("  1. route_data.imageUrl")
        print("  2. route_data.cover_url")
        print("  3. route_data.cover_image")
        print("  4. waypoints with imageUrl")
        print("  5. Default placeholder if none found")
        
    except Exception as e:
        print(f"❌ Error checking community routes: {e}")
        import traceback
        traceback.print_exc()

def check_emotion_notes():
    """Check emotion notes with images"""
    print("\n3. Checking emotion notes with images...")
    
    try:
        # Check if team_member_emotions table has image_url column
        response = supabase.table('team_member_emotions') \
            .select('*') \
            .limit(5) \
            .execute()
        
        data = response.data
        print(f"Found {len(data)} emotion notes")
        
        for i, note in enumerate(data):
            print(f"\nEmotion note {i+1}:")
            print(f"  Emotion: {note.get('emotion')}")
            print(f"  Note: {note.get('note')}")
            print(f"  Image URL: {note.get('image_url')}")
            print(f"  Created at: {note.get('created_at')}")
            
    except Exception as e:
        print(f"❌ Error checking emotion notes: {e}")

if __name__ == "__main__":
    check_community_routes()
    check_emotion_notes()
    print("\n✅ Analysis complete!")
    print("\n📋 Recommendations:")
    print("1. If community routes don't have images, they'll show a placeholder")
    print("2. Emotion notes with images should show in CompanionView")
    print("3. Check frontend at http://localhost:3001 to see changes")