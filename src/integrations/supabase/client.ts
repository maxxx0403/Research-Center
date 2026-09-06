import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ukkegicebltaeetrgzit.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVra2VnaWNlYmx0YWVldHJneml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODM0MzYsImV4cCI6MjA5OTg1OTQzNn0.HSAXDk8hoc07RN72X7m6BWim6ob7G5Is7Ra7Zy8B7II';

if (!SUPABASE_URL) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY environment variable');
}

console.log('Supabase URL:', SUPABASE_URL);
console.log('Supabase Project:', SUPABASE_URL.split('//')[1].split('.')[0]);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // PKCE is more resistant to token interception/replay than the old
    // implicit flow (no access token ever appears in a redirect URL).
    flowType: 'pkce',
  },
  db: {
    schema: 'public',
  },
});