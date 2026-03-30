import sqlite3
import sys

def create_tables():
    try:
        conn = sqlite3.connect('database.sqlite')
        cursor = conn.cursor()
        
        # Create team_member_emotions table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS team_member_emotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id TEXT,
            user_id TEXT NOT NULL,
            user_name TEXT,
            content TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CHECK (latitude BETWEEN -90 AND 90),
            CHECK (longitude BETWEEN -180 AND 180)
        )
        ''')
        
        # Create uploaded_route_images table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS uploaded_route_images (
            id TEXT PRIMARY KEY,
            uploaded_route_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            image_url TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            caption TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (uploaded_route_id) REFERENCES uploaded_routes(id) ON DELETE CASCADE
        )
        ''')
        
        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_team_member_emotions_team_created_at ON team_member_emotions(team_id, created_at DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_team_member_emotions_user_created_at ON team_member_emotions(user_id, created_at DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_uploaded_route_images_route_id ON uploaded_route_images(uploaded_route_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_uploaded_route_images_user_id ON uploaded_route_images(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_uploaded_route_images_geo ON uploaded_route_images(latitude, longitude)')
        
        conn.commit()
        
        # Verify the tables were created
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        print("Tables created successfully:")
        for table in tables:
            print(f"- {table[0]}")
        
        # Check team_member_emotions columns
        cursor.execute("PRAGMA table_info(team_member_emotions)")
        columns = cursor.fetchall()
        
        print("\nColumns in team_member_emotions:")
        for col in columns:
            print(f"- {col[1]} ({col[2]})")
        
        has_image_url = any(col[1] == 'image_url' for col in columns)
        print(f"\nHas image_url column: {has_image_url}")
        
        conn.close()
        print("\n✅ Database setup completed successfully!")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    success = create_tables()
    sys.exit(0 if success else 1)