const env = import.meta.env || {};
export const config = {
  url: env.VITE_SUPABASE_URL || '',
  key: env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  demo: env.VITE_DEMO_MODE === 'true',
};
// Public configuration is intentionally the only configuration shipped to the browser.
export function configurationError() {
  if (config.demo) return '';
  if (!config.url || !config.key) return 'Collega Supabase per aprire il workspace. Segui la guida di configurazione nel README.';
  if (!/^https:\/\//.test(config.url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(config.url)) return 'L’indirizzo Supabase deve usare HTTPS.';
  if (config.key.startsWith('sb_secret_')) return 'La configurazione richiede una chiave pubblica publishable, mai una chiave segreta.';
  try {
    const payload = config.key.split('.')[1];
    if (payload && JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role') return 'Rimuovi la service role key: usa la chiave pubblica publishable o anon.';
  } catch { /* A publishable key is not a JWT. */ }
  return '';
}
