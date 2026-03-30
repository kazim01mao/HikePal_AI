import sqlite3 from 'sqlite3';
const { verbose } = sqlite3;
const sqlite3Verbose = verbose();
const db = new sqlite3Verbose.Database('database.sqlite');

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('Tables in database:');
  tables.forEach(table => {
    console.log(`- ${table.name}`);
  });
  
  // Check if team_member_emotions exists
  const teamEmotionsExists = tables.some(t => t.name === 'team_member_emotions');
  console.log(`\nteam_member_emotions table exists: ${teamEmotionsExists}`);
  
  if (teamEmotionsExists) {
    // Check its columns
    db.all("PRAGMA table_info(team_member_emotions)", (err, columns) => {
      if (err) {
        console.error('Error getting columns:', err);
      } else {
        console.log('\nColumns in team_member_emotions:');
        columns.forEach(col => {
          console.log(`- ${col.name} (${col.type})`);
        });
        
        const hasImageUrl = columns.some(c => c.name === 'image_url');
        console.log(`\nHas image_url column: ${hasImageUrl}`);
      }
      db.close();
    });
  } else {
    db.close();
  }
});
