import { readFileSync } from 'node:fs';
import OpenAI from 'openai';

const env = (k: string) => readFileSync('.env.local', 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'))![1];
const client = new OpenAI({ apiKey: env('FOUNDRY_API_KEY'), baseURL: `https://${env('FOUNDRY_RESOURCE')}.openai.azure.com/openai/v1/` });
const num = { type: ['number', 'null'] };
const schema = { type: 'object', additionalProperties: false, required: ['vendor', 'date', 'subtotal', 'vat', 'total'],
  properties: { vendor: { type: ['string', 'null'] }, date: { type: ['string', 'null'] }, subtotal: num, vat: num, total: num } };
const b64 = readFileSync(process.argv[2]).toString('base64');

async function main() {
  const t = Date.now();
  const r = await client.chat.completions.create({
    model: 'gpt-6.1-sol', reasoning_effort: 'low',
    response_format: { type: 'json_schema', json_schema: { name: 'receipt', strict: true, schema } },
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Read this receipt. Dates as YYYY-MM-DD. null if absent.' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }] }],
  } as never);
  console.log('chat.completions+json_schema+vision', Date.now() - t, 'ms', r.choices[0].message.content);
}
main().catch((e) => console.log('ERR', e.status, String(e.message).slice(0, 300)));
