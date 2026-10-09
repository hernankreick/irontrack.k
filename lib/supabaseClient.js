import { createClient } from '@supabase/supabase-js';
import { createSharedReadOnlyFetch } from './sharedMode.js';
import { createResidualTokenGuardFetch } from './residualTokenGuard.js';

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
      // Con un logout pendiente (cerrado sin red) el SDK conserva el token residual: este fetch impide usarlo en /rest, /functions y
      // /storage (en un enlace compartido las lecturas salen como anonimas). Ver lib/residualTokenGuard.js.
      global: { fetch: createResidualTokenGuardFetch(createSharedReadOnlyFetch(), { anonKey: key }) },
    })
  : null;
