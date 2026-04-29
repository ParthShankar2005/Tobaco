import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://uddkkxikzzeuwjgwgjba.supabase.co";
const fallbackAnonKey = "sb_publishable_q8a5j9sioIXRtnUgrxFXnw_8nr29SVL";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackUrl;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackAnonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

