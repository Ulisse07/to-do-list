import { supabase } from './supabase.js';
import { config } from './config.js';
export const memberSessionKey = config.demo ? 'eng-demo-member' : 'eng-member';
export async function currentSession() {
  if (config.demo) return sessionStorage.getItem('eng-demo-session') === 'active';
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return Boolean(data.session);
}
export async function signIn(email, password) {
  if (config.demo) { sessionStorage.setItem('eng-demo-session', 'active'); return; }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Accesso non riuscito. Verifica email e password o riprova tra poco.');
}
export async function signOut() {
  if (config.demo) sessionStorage.removeItem('eng-demo-session');
  else {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
  sessionStorage.removeItem(memberSessionKey);
}
export function selectMember(id) { sessionStorage.setItem(memberSessionKey, id); }
export const selectedMember = () => sessionStorage.getItem(memberSessionKey);
