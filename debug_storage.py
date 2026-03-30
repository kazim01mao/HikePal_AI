import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
ANON_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')
SERVICE_ROLE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

print("🔍 Debugging Supabase Storage...")
print(f"Supabase URL: {SUPABASE_URL}")
print(f"Anon Key: {ANON_KEY[:20]}...")
print(f"Service Role Key: {SERVICE_ROLE_KEY[:20]}...")

# Test 1: Try with service role key (should have full access)
print("\n1. Testing with Service Role Key...")
url = f"{SUPABASE_URL}/storage/v1/bucket"
headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
}

try:
    response = requests.get(url, headers=headers)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        buckets = response.json()
        print(f"   ✅ Success! Found {len(buckets)} bucket(s):")
        for bucket in buckets:
            print(f"     - {bucket.get('name')} (public: {bucket.get('public')})")
            if bucket.get('name') == 'emotion-images':
                print(f"       ✅ emotion-images bucket exists!")
    elif response.status_code == 403:
        print("   ❌ Permission denied with service role key")
        print(f"   Response: {response.text}")
    else:
        print(f"   Response: {response.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: Try to create bucket if it doesn't exist
print("\n2. Checking/creating emotion-images bucket...")
bucket_data = {
    "name": "emotion-images",
    "public": True,
    "file_size_limit": 5242880  # 5MB
}

try:
    # First check if it exists
    check_url = f"{SUPABASE_URL}/storage/v1/bucket/emotion-images"
    check_response = requests.get(check_url, headers=headers)
    
    if check_response.status_code == 200:
        print(f"   ✅ Bucket already exists")
        bucket_info = check_response.json()
        print(f"   Name: {bucket_info.get('name')}")
        print(f"   Public: {bucket_info.get('public')}")
    elif check_response.status_code == 404:
        print("   ℹ️ Bucket doesn't exist, trying to create...")
        create_url = f"{SUPABASE_URL}/storage/v1/bucket"
        create_response = requests.post(create_url, headers=headers, json=bucket_data)
        print(f"   Create status: {create_response.status_code}")
        if create_response.status_code == 200:
            print("   ✅ Bucket created successfully!")
        elif create_response.status_code == 409:
            print("   ℹ️ Bucket already exists (conflict)")
        else:
            print(f"   ❌ Failed to create: {create_response.text}")
    else:
        print(f"   ❌ Unexpected status: {check_response.status_code}")
        print(f"   Response: {check_response.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Test public access with anonymous key
print("\n3. Testing public access with Anonymous Key...")
anon_headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}"
}

# Try to list buckets (might not work with anonymous key)
try:
    list_url = f"{SUPABASE_URL}/storage/v1/bucket"
    list_response = requests.get(list_url, headers=anon_headers)
    print(f"   List buckets status: {list_response.status_code}")
    if list_response.status_code == 200:
        buckets = list_response.json()
        print(f"   ✅ Anonymous can list buckets!")
        print(f"   Found {len(buckets)} bucket(s)")
    else:
        print(f"   Response: {list_response.text[:200]}...")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 4: Try to list files in emotion-images bucket
print("\n4. Testing file listing in emotion-images...")
try:
    files_url = f"{SUPABASE_URL}/storage/v1/object/list/emotion-images"
    files_response = requests.get(files_url, headers=anon_headers)
    print(f"   Status: {files_response.status_code}")
    if files_response.status_code == 200:
        files = files_response.json()
        print(f"   ✅ Public can list files!")
        print(f"   Found {len(files)} file(s)")
    elif files_response.status_code == 403:
        print("   ❌ Permission denied. Need to set public read policy.")
    elif files_response.status_code == 404:
        print("   ❌ Bucket not found or inaccessible.")
    else:
        print(f"   Response: {files_response.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n📋 Recommendations:")
print("1. If bucket doesn't exist: Run 'python3 create_bucket_local.py'")
print("2. If permissions are wrong: Follow STORAGE_SETUP_GUIDE.md")
print("3. Check Supabase Dashboard: https://supabase.com/dashboard/project/ojcvrvutsylptamslntq/storage")
print("4. Make sure bucket is marked as 'Public'")
print("5. Set policies via Dashboard UI (not SQL)")