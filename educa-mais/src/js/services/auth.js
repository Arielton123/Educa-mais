import { requireSupabase } from './supabase.js';
import { errorMessage, toast } from '../utils/helpers.js';

export async function signIn(email, password) {
  const db = requireSupabase();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(errorMessage(error));
  return data;
}

export async function sendPasswordRecovery(email) {
  const db = requireSupabase();
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(errorMessage(error));
}

export async function signOut() {
  const db = requireSupabase();
  const { error } = await db.auth.signOut();
  if (error) throw new Error(errorMessage(error));
}

export async function updatePassword(password) {
  const db = requireSupabase();
  const { error } = await db.auth.updateUser({ password });
  if (error) throw new Error(errorMessage(error));
  toast('Senha atualizada.');
}
