// =============================================================================
// Cliente único do Supabase usado por todo o front-end.
// supabase-js v2 importado do CDN com VERSÃO FIXA (atualize de forma consciente).
// A chave usada é a pública (publishable/anon): a segurança real está na RLS e
// nas funções do banco. A chave service_role NUNCA deve aparecer aqui.
// =============================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (!SUPABASE_URL?.startsWith('https://') || SUPABASE_URL.includes('SEU-PROJETO') || !SUPABASE_ANON_KEY
    || SUPABASE_ANON_KEY.includes('COLE_AQUI')) {
  throw new Error('Configuração do Supabase ausente. Preencha js/config.js (modelo em js/config.example.js).');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
