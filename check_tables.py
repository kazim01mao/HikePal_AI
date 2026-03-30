import sqlite3
import sys

def check_database():
    try:
        conn = sqlite3.connect('database.sqlite')
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        print("Tables in database:")
        for table in tables:
            print(f"- {table[0]}")
        
        # Check if team_member_emotions exists
        team_emotions_exists = any(table[0] == 'team_member_emotions' for table in tables)
        print(f"\nteam_member_emotions table exists: {team_emotions_exists}")
        
        if team_emotions_exists:
            # Get column info
            cursor.execute("PRAGMA table_info(team_member_emotions)")
            columns = cursor.fetchall()
            
            print("\nColumns in team_member_emotions:")
            for col in columns:
                print(f"- {col[1]} ({col[2]})")
            
            has_image_url = any(col[1] == 'image_url' for col in columns)
            print(f"\nHas image_url column: {has_image_url}")
            
            if not has_image_url:
                print("\nAdding image_url column...")
                try:
                    cursor.execute("ALTER TABLE team_member_emotions ADD COLUMN image_url TEXT")
                    conn.commit()
                    print("Successfully added image_url column!")
                except Exception as e:
                    print(f"Error adding column: {e}")
        
        conn.close()
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    success = check_database()
    sys.exit(0 if success else 1)