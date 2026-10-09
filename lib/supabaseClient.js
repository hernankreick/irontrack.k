import { createClient } from '@supabase/supabase-js';
import { createSharedReadOnlyFetch } from './sharedMode.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      // En un enlace compartido (?r=) el cliente no envia escrituras a /rest, /functions ni /storage (barrera del cliente;
      // /auth/v1 no se toca). Fuera de ese modo es el fetch normal. Ver lib/sharedMode.js.
      global: { fetch: createSharedReadOnlyFetch() },
    })
  : null;
