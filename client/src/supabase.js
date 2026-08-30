// Electron desktop mode — NO Supabase, fully offline
// Online SaaS mode — real Supabase connection

const isElectron = import.meta.env.VITE_MODE === 'electron';

let supabaseClient = null;

if (!isElectron) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
