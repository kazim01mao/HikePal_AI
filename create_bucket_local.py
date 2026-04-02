import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SERVICE_ROLE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

if not SERVICE_ROLE_KEY:
    print("❌ Service role key not found in .env.local")
    print("Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env.local file")
    exit(1)

def create_bucket():
    """Create a public bucket for emotion images using service role key"""
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "name": "emotion-images",
        "public": True,
        "file_size_limit": 5242880  # 5MB
    }
    
    try:
        print(f"Creating bucket 'emotion-images' at {SUPABASE_URL}...")
        response = requests.post(url, headers=headers, json=data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Bucket created successfully!")
            return True
        elif response.status_code == 409:
            print("ℹ️ Bucket already exists")
            return True
        else:
            print(f"❌ Failed to create bucket: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def list_buckets():
    """List all buckets"""
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
    }
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            buckets = response.json()
            print(f"Found {len(buckets)} bucket(s):")
            for bucket in buckets:
                print(f"  - {bucket['name']} (public: {bucket.get('public', False)})")
        else:
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

def set_bucket_policies():
    """Set bucket policies to allow public read and authenticated upload"""
    # First, let's check if we need to install python-dotenv
    try:
        import dotenv
    except ImportError:
        print("Installing python-dotenv...")
        import subprocess
        subprocess.check_call(["pip3", "install", "python-dotenv"])
    
    print("\n📋 Bucket policies should be set in Supabase dashboard:")
    print("1. Go to https://supabase.com/dashboard/project/ojcvrvutsylptamslntq/storage")
    print("2. Click on 'emotion-images' bucket")
    print("3. Go to 'Policies' tab")
    print("4. Create the following policies:")
    print("   a. SELECT policy: Allow public access")
    print("   b. INSERT policy: Allow authenticated users")
    print("   c. UPDATE policy: Allow authenticated users (if needed)")
    print("   d. DELETE policy: Allow authenticated users (if needed)")

if __name__ == "__main__":
    print("🔍 Checking existing buckets...")
    list_buckets()
    
    print("\n🛠️ Creating bucket...")
    if create_bucket():
        print("\n✅ Bucket setup completed!")
        print("\n📋 Next steps:")
        print("1. The 'emotion-images' bucket has been created")
        print("2. You need to set bucket policies in Supabase dashboard")
        print("3. The frontend will now be able to upload images")
        
        set_bucket_policies()
    else:
        print("\n❌ Failed to create bucket. Please check your service role key and try again.")