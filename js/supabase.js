import { createClient } from '@supabase/supabase-js';
import { config, configurationError } from './config.js';
export const supabase = !config.demo && !configurationError() ? createClient(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.sessionStorage },
}) : null;
export async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || 'Impossibile salvare. Riprova.');
  return data;
}
