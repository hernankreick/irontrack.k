import { createClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from './supabaseEnv.js';

// Sin valores de respaldo: si faltan las variables (p. ej. un Preview sin base de datos) `supabase` es null y la app queda inerte.
export const SUPABASE_ENV = readSupabaseEnv(import.meta.env);

export const supabase = SUPABASE_ENV.configured
  ? createClient(SUPABASE_ENV.url, SUPABASE_ENV.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
