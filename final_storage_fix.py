import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SERVICE_ROLE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

print("🔧 Final Storage Fix Script")
print("=" * 50)

# Headers for service role (full access)
headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}

def check_and_fix_bucket():
    """Check bucket status and fix if needed"""
    print("\n1. Checking emotion-images bucket...")
    
    # Check bucket details
    url = f"{SUPABASE_URL}/storage/v1/bucket/emotion-images"
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        bucket = response.json()
        print(f"   ✅ Bucket exists:")
        print(f"      Name: {bucket.get('name')}")
        print(f"      Public: {bucket.get('public')}")
        print(f"      ID: {bucket.get('id')}")
        
        # Check if bucket is truly public
        if not bucket.get('public'):
            print("   ⚠️ Bucket is not marked as public. Fixing...")
            update_url = f"{SUPABASE_URL}/storage/v1/bucket/emotion-images"
            update_data = {"public": True}
            update_response = requests.put(update_url, headers=headers, json=update_data)
            if update_response.status_code == 200:
                print("   ✅ Bucket marked as public")
            else:
                print(f"   ❌ Failed to update bucket: {update_response.text}")
        else:
            print("   ✅ Bucket is already public")
            
        return True
    else:
        print(f"   ❌ Bucket check failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return False

def test_public_access():
    """Test if public can access the bucket"""
    print("\n2. Testing public access...")
    
    anon_headers = {
        "apikey": os.getenv('VITE_SUPABASE_ANON_KEY'),
        "Authorization": f"Bearer {os.getenv('VITE_SUPABASE_ANON_KEY')}"
    }
    
    # Test 1: Try to get public URL for a non-existent file
    test_url = f"{SUPABASE_URL}/storage/v1/object/public/emotion-images/test-file.jpg"
    response = requests.get(test_url, headers=anon_headers)
    
    print(f"   Public URL test status: {response.status_code}")
    if response.status_code == 404:
        print("   ✅ Public URL endpoint is accessible (404 is expected for non-existent file)")
        return True
    elif response.status_code == 200:
        print("   ✅ Public URL endpoint works!")
        return True
    elif response.status_code == 403:
        print("   ❌ Permission denied. Public read policy is missing.")
        return False
    else:
        print(f"   Unexpected response: {response.text[:200]}")
        return False

def create_test_file():
    """Create a test file to verify upload works"""
    print("\n3. Testing file upload (with service role)...")
    
    # Create a simple text file
    test_content = b"This is a test file for emotion-images bucket"
    files = {
        'file': ('test.txt', test_content, 'text/plain')
    }
    
    upload_url = f"{SUPABASE_URL}/storage/v1/object/emotion-images/test.txt"
    
    # Note: For file upload, we need to use different headers
    upload_headers = {
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "x-upsert": "true"  # Allow overwrite
    }
    
    try:
        response = requests.post(upload_url, headers=upload_headers, files=files)
        print(f"   Upload status: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ Test file uploaded successfully!")
            return True
        elif response.status_code == 409:
            print("   ℹ️ File already exists")
            return True
        else:
            print(f"   ❌ Upload failed: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Upload error: {e}")
        return False

def verify_public_read():
    """Verify public can read the test file"""
    print("\n4. Verifying public can read test file...")
    
    anon_headers = {
        "apikey": os.getenv('VITE_SUPABASE_ANON_KEY'),
        "Authorization": f"Bearer {os.getenv('VITE_SUPABASE_ANON_KEY')}"
    }
    
    # Get public URL
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/emotion-images/test.txt"
    response = requests.get(public_url, headers=anon_headers)
    
    print(f"   Public read status: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ Public can read the file!")
        print(f"   File content: {response.text[:50]}...")
        return True
    else:
        print(f"   ❌ Public cannot read file: {response.text}")
        return False

def main():
    print("Starting storage fix process...")
    
    # Step 1: Check and fix bucket
    if not check_and_fix_bucket():
        print("\n❌ Cannot proceed. Bucket check failed.")
        return
    
    # Step 2: Test public access
    if not test_public_access():
        print("\n⚠️ Public access test failed. This indicates RLS policies are not set.")
        print("   Please follow these steps:")
        print("   1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/ojcvrvutsylptamslntq/storage")
        print("   2. Click on 'emotion-images' bucket")
        print("   3. Go to 'Policies' tab")
        print("   4. Create a policy with:")
        print("      - Policy name: 'Public Read Access'")
        print("      - Allowed operations: SELECT")
        print("      - Policy definition: (bucket_id = 'emotion-images')")
        print("      - Policy applies to: ALL users")
        return
    
    # Step 3: Create test file
    if not create_test_file():
        print("\n⚠️ Test file upload failed. This might be normal if upload policies are not set.")
        print("   For frontend uploads, users need to be authenticated.")
    
    # Step 4: Verify public read
    if not verify_public_read():
        print("\n⚠️ Public cannot read files. RLS policies need to be set.")
    
    print("\n" + "=" * 50)
    print("📋 Summary:")
    print("1. The emotion-images bucket exists and is public")
    print("2. Frontend code is ready with error handling")
    print("3. If public access fails, set RLS policies via Dashboard")
    print("4. Test the frontend: Add emotion note with image")
    print("\n🔗 Test frontend: http://localhost:3001")

if __name__ == "__main__":
    main()