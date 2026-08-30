// Run this script to fix Supabase daily_closing table
// Usage: node fix_supabase.js
// This adds the missing 'closed_by_name' column

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pitkgpyqhqgdqsxikddu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpdGtncHlxaHFnZHFzeGlrZGR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODg5OTYsImV4cCI6MjEwMDM2NDk5Nn0.LgdHV-pIvqmJNVmLrxonWWkPG4FAyo4szqLczXAQh_8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('Checking daily_closing table...');

  // Check existing columns
  const { data, error } = await supabase
    .from('daily_closing')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error accessing daily_closing:', error.message);
    return;
  }

  console.log('daily_closing table exists. Sample row keys:', data.length > 0 ? Object.keys(data[0]) : 'empty table');

  if (data.length > 0 && 'closed_by_name' in data[0]) {
    console.log('✅ closed_by_name column already exists!');
  } else {
    console.log('❌ closed_by_name column MISSING - need to add via Supabase SQL Editor');
    console.log('');
    console.log('Run this SQL in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/pitkgpyqhqgdqsxikddu/editor');
    console.log('');
    console.log('ALTER TABLE daily_closing ADD COLUMN IF NOT EXISTS closed_by_name TEXT;');
  }
}

main().catch(console.error);
