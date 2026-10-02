import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;
export const db = () => (client ??= createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } }));
