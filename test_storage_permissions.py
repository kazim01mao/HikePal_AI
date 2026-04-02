import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
ANON_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')
SERVICE_ROLE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

def test_storage_permissions():
    """Test storage bucket permissions"""
    print("🔍 Testing storage bucket permissions...")
    
    # Test 1: Check if bucket exists and is public
    print("\n1. Checking bucket info...")
    # Try different API endpoints
    endpoints = [
        f"{SUPABASE_URL}/storage/v1/bucket/emotion-images",
        f"{SUPABASE_URL}/storage/v1/bucket"
    ]
    
    bucket_found = False
    for url in endpoints:
        headers = {
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}"
        }
        
        try:
            response = requests.get(url, headers=headers)
            print(f"   Endpoint: {url}")
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                if url.endswith('/emotion-images'):
                    bucket_info = response.json()
                    print(f"   ✅ Bucket exists!")
                    print(f"   Name: {bucket_info.get('name')}")
                    print(f"   Public: {bucket_info.get('public')}")
                    print(f"   File size limit: {bucket_info.get('file_size_limit', 'N/A')}")
                    bucket_found = True
                    break
                else:
                    # List all buckets
                    buckets = response.json()
                    print(f"   Found {len(buckets)} bucket(s)")
                    for bucket in buckets:
                        print(f"     - {bucket.get('name')} (public: {bucket.get('public')})")
                        if bucket.get('name') == 'emotion-images':
                            print(f"   ✅ emotion-images bucket found in list!")
                            bucket_found = True
                    if bucket_found:
                        break
            else:
                print(f"   Response: {response.text[:100]}...")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    if not bucket_found:
        print("   ❌ Could not find emotion-images bucket via API")
    
    # Test 2: Try to list files (public read access)
    print("\n2. Testing public read access...")
    url = f"{SUPABASE_URL}/storage/v1/object/list/emotion-images"
    try:
        response = requests.get(url, headers=headers)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            files = response.json()
            print(f"   ✅ Public read access works!")
            print(f"   Found {len(files)} file(s)")
            for i, file in enumerate(files[:3]):  # Show first 3 files
                print(f"     {i+1}. {file.get('name')} ({file.get('size', 0)} bytes)")
            if len(files) > 3:
                print(f"     ... and {len(files) - 3} more")
        elif response.status_code == 403:
            print("   ❌ Permission denied. Public read policy is missing.")
            print("   Run the SQL script to set 'Allow public reads' policy.")
        else:
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Try to upload a test file (would need authentication)
    print("\n3. Testing upload permission (would need auth token)...")
    print("   Note: Upload test requires a valid auth token.")
    print("   This test is skipped as it requires user authentication.")
    
    # Test 4: Check if we can get a public URL for a file
    print("\n4. Testing public URL generation...")
    # Create a test file path
    test_file_path = "test-user/test-file.jpg"
    url = f"{SUPABASE_URL}/storage/v1/object/public/emotion-images/{test_file_path}"
    try:
        response = requests.get(url, headers=headers)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ Public URL endpoint works!")
        elif response.status_code == 404:
            print("   ℹ️ File doesn't exist (expected for test file)")
            print("   ✅ Public URL endpoint is accessible")
        else:
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Summary
    print("\n📋 Summary:")
    print("1. Copy the SQL script from 'set_storage_policies_simple.sql'")
    print("2. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/ojcvrvutsylptamslntq/sql")
    print("3. Paste and run the SQL script")
    print("4. The policies will be set up for:")
    print("   - Public read access (anyone can view images)")
    print("   - Authenticated users can upload images")
    print("   - Users can update/delete their own files")
    
    print("\n🔧 If you still have issues:")
    print("1. Make sure the bucket is marked as 'public' in Supabase dashboard")
    print("2. Check that RLS is enabled on storage.objects table")
    print("3. Verify the policies were created successfully")

if __name__ == "__main__":
    test_storage_permissions()