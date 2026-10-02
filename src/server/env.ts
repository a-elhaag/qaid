const req = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

export const env = {
  get supabaseUrl() { return req('SUPABASE_URL'); },
  get serviceKey() { return req('SUPABASE_SERVICE_ROLE_KEY'); },
  get foundryResource() { return req('FOUNDRY_RESOURCE'); },
  get foundryKey() { return req('FOUNDRY_API_KEY'); },
  get fusion() { return (process.env.FUSION ?? 'on') === 'on'; },
  get cronSecret() { return req('CRON_SECRET'); },
};
