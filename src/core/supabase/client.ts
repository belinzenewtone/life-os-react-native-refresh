import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { supabaseSecureStorage } from '@/core/security/supabase-storage';
import { supabaseKey, supabaseUrl } from '@/core/supabase/config';

const fallbackSupabaseUrl = 'https://placeholder.supabase.co';
const fallbackSupabaseKey = 'sb_publishable_placeholder';

export const supabaseClient = createClient(supabaseUrl ?? fallbackSupabaseUrl, supabaseKey ?? fallbackSupabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: supabaseSecureStorage,
  },
});
