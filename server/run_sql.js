import fs from 'fs';
import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:3%26Ecnomw7278@db.pitkgpyqhqgdqsxikddu.supabase.co:5432/postgres';

async function run() {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL!');

    const sqlFile = fs.readFileSync('C:/Users/pc/.gemini/antigravity/brain/2f0c52d0-6a12-4dda-a850-9c800b96e818/supabase_schema.sql', 'utf8');
    
    console.log('Running SQL Schema...');
    await client.query(sqlFile);
    console.log('Schema successfully applied to Supabase!');
    
  } catch (err) {
    console.error('Database connection or query failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
