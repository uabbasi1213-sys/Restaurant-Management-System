// Electron desktop mode — NO Supabase, fully offline
// Online SaaS mode — real Supabase connection

import { createClient } from '@supabase/supabase-js';

const isElectron = import.meta.env.VITE_MODE === 'electron';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient = null;

if (!isElectron) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

export const supabase = supabaseClient;
