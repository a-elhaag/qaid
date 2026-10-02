import { readFileSync } from 'node:fs';
import { CohereClientV2 } from 'cohere-ai';

const env = (k: string) => {
  const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'));
  if (!m) throw new Error(`missing ${k}`);
  return m[1];
};
const file = process.argv[2];
const co = new CohereClientV2({
  token: env('FOUNDRY_API_KEY'),
  environment: `https://${env('FOUNDRY_RESOURCE')}.services.ai.azure.com/providers/cohere`,
});
co.parse({
  model: 'cohere-parse-v5',
  document: { type: 'image_url', imageUrl: `data:image/jpeg;base64,${readFileSync(file).toString('base64')}` },
  outputFormat: 'markdown',
}).then((r) => console.log(JSON.stringify(r, null, 1).slice(0, 700)), (e: { statusCode?: number; message?: string }) => console.log('ERR', e.statusCode, String(e.message).slice(0, 300)));
