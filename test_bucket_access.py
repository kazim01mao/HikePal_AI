import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
ANON_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def test_bucket_access():
    """Test if we can access the bucket with anonymous key"""
    # Test 1: List buckets
    print("🔍 Testing bucket access...")
    
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}"
    }
    
    try:
        response = requests.get(url, headers=headers)
        print(f"List buckets status: {response.status_code}")
        if response.status_code == 200:
            buckets = response.json()
            print(f"Found {len(buckets)} bucket(s):")
            for bucket in buckets:
                print(f"  - {bucket['name']} (public: {bucket.get('public', False)})")
                
                # Check if emotion-images exists
                if bucket['name'] == 'emotion-images':
                    print(f"    ✅ emotion-images bucket found!")
                    print(f"    Public: {bucket.get('public', False)}")
                    print(f"    File size limit: {bucket.get('file_size_limit', 'N/A')}")
        else:
            print(f"Failed to list buckets: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 2: Try to list files in emotion-images bucket
    print("\n🔍 Testing file listing in emotion-images bucket...")
    url = f"{SUPABASE_URL}/storage/v1/object/list/emotion-images"
    try:
        response = requests.get(url, headers=headers)
        print(f"List files status: {response.status_code}")
        if response.status_code == 200:
            files = response.json()
            print(f"Found {len(files)} file(s) in emotion-images bucket")
        elif response.status_code == 403:
            print("❌ Permission denied. Bucket policies need to be set.")
            print("Please set bucket policies in Supabase dashboard:")
            print("1. Go to https://supabase.com/dashboard/project/ojcvrvutsylptamslntq/storage")
            print("2. Click on 'emotion-images' bucket")
            print("3. Go to 'Policies' tab")
            print("4. Create a SELECT policy: Allow public access")
        else:
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_bucket_access()