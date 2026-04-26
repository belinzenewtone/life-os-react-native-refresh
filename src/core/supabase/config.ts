const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const rawAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
const rawPublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

export const supabaseUrl = rawSupabaseUrl || null;
export const supabaseKey = rawAnonKey || rawPublishableKey || null;

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseKey);
}
