import { createClient } from '@supabase/supabase-js';
import { DEMO_MODE, demoApi } from './demoMode.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Demo: cliente SIMULADO sin red (demo/demoClient.js, registrado por demo/bootDemo.js antes de montar la app). Nunca se crea el cliente real.
const demoClient = DEMO_MODE
  ? new Proxy({}, { get: (_t, p) => { const api = demoApi(); return api && api.client ? api.client[p] : undefined; } })
  : null;

export const supabase = DEMO_MODE ? demoClient : url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
