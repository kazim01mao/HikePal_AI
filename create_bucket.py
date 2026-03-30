import requests
import json

# Supabase configuration
SUPABASE_URL = "https://ojcvrvutsylptamslntq.supabase.co"
# Try to use service role key if available, otherwise use anon key
# Note: You need to get the service role key from Supabase dashboard
ANON_KEY = "sb_publishable_UZf341-Gio8qK8M0EZUoQQ_g2X9TW8i"

def create_bucket():
    """Create a public bucket for emotion images"""
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "name": "emotion-images",
        "public": True,
        "file_size_limit": 5242880  # 5MB
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Bucket created successfully!")
        elif response.status_code == 403:
            print("❌ Permission denied. You need a service role key to create buckets.")
            print("Please create the bucket manually in Supabase dashboard:")
            print("1. Go to https://supabase.com/dashboard/project/ojcvrvutsylptamslntq/storage")
            print("2. Click 'Create a new bucket'")
            print("3. Name it 'emotion-images'")
            print("4. Set it to public")
            print("5. Set file size limit to 5MB")
        else:
            print(f"❌ Failed to create bucket: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

def list_buckets():
    """List all buckets"""
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}"
    }
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Buckets: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("Listing existing buckets...")
    list_buckets()
    print("\nTrying to create bucket...")
    create_bucket()