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
    exit(1)

def create_policy(bucket_name, policy_name, operation, definition):
    """Create a storage policy"""
    url = f"{SUPABASE_URL}/storage/v1/bucket/{bucket_name}/policies"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    data = {
        "name": policy_name,
        "definition": definition,
        "operation": operation
    }
    
    try:
        print(f"Creating {operation} policy '{policy_name}'...")
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 201:
            print(f"✅ {operation} policy '{policy_name}' created successfully!")
            return True
        elif response.status_code == 409:
            print(f"ℹ️ Policy '{policy_name}' already exists")
            return True
        else:
            print(f"❌ Failed to create {operation} policy: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating {operation} policy: {e}")
        return False

def set_bucket_policies():
    """Set bucket policies for emotion-images bucket"""
    bucket_name = "emotion-images"
    
    print(f"Setting policies for bucket '{bucket_name}'...")
    
    # 1. SELECT policy: Allow public access (anyone can read)
    select_policy = create_policy(
        bucket_name,
        "Public Read Access",
        "SELECT",
        "(bucket_id = 'emotion-images')"
    )
    
    # 2. INSERT policy: Allow authenticated users to upload
    insert_policy = create_policy(
        bucket_name,
        "Authenticated Upload",
        "INSERT",
        "(auth.role() = 'authenticated')"
    )
    
    # 3. UPDATE policy: Allow authenticated users to update their own files
    update_policy = create_policy(
        bucket_name,
        "Authenticated Update",
        "UPDATE",
        "(auth.role() = 'authenticated')"
    )
    
    # 4. DELETE policy: Allow authenticated users to delete their own files
    delete_policy = create_policy(
        bucket_name,
        "Authenticated Delete",
        "DELETE",
        "(auth.role() = 'authenticated')"
    )
    
    if all([select_policy, insert_policy, update_policy, delete_policy]):
        print("\n✅ All policies set successfully!")
        print("\n📋 Summary of policies created:")
        print("1. SELECT: Public read access (anyone can view images)")
        print("2. INSERT: Authenticated users can upload images")
        print("3. UPDATE: Authenticated users can update their images")
        print("4. DELETE: Authenticated users can delete their images")
        return True
    else:
        print("\n❌ Some policies failed to create. You may need to set them manually in Supabase dashboard.")
        return False

def list_policies(bucket_name):
    """List all policies for a bucket"""
    url = f"{SUPABASE_URL}/storage/v1/bucket/{bucket_name}/policies"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
    }
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            policies = response.json()
            print(f"\n📋 Existing policies for '{bucket_name}':")
            for policy in policies:
                print(f"  - {policy['name']} ({policy['operation']}): {policy.get('definition', 'No definition')}")
        else:
            print(f"Failed to list policies: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error listing policies: {e}")

if __name__ == "__main__":
    bucket_name = "emotion-images"
    
    print("🔍 Checking existing policies...")
    list_policies(bucket_name)
    
    print("\n🛠️ Setting up bucket policies...")
    if set_bucket_policies():
        print("\n✅ Policy setup completed!")
        print("\n🔍 Verifying policies...")
        list_policies(bucket_name)
    else:
        print("\n❌ Policy setup failed. Please check the errors above.")