import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const allowed = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_DEMO_MODE']);
  for (const name of Object.keys(env)) if (!allowed.has(name)) throw new Error(`Variabile frontend non prevista: ${name}. Non esporre segreti con il prefisso VITE_.`);
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (key.startsWith('sb_secret_')) throw new Error('Build bloccata: usa una chiave Supabase pubblica publishable, mai secret.');
  if (key.split('.').length === 3) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { throw new Error('Chiave Supabase JWT non valida.'); }
    if (role !== 'anon') throw new Error('Build bloccata: la chiave JWT frontend deve avere ruolo anon.');
  }
  if (env.VITE_SUPABASE_URL) {
    const url = new URL(env.VITE_SUPABASE_URL);
    if (url.username || url.password || url.search) throw new Error('L’URL Supabase non deve contenere credenziali o parametri.');
  }
  return { base: './', server: { host: '127.0.0.1', port: 5173, strictPort: true } };
});
