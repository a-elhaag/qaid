import { readFileSync } from 'node:fs';
import OpenAI from 'openai';
import { Agent, run, tool, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from '@openai/agents';
import { z } from 'zod';

const env = (k: string) => readFileSync('.env.local', 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'))![1];
setTracingDisabled(true);
setDefaultOpenAIClient(new OpenAI({ apiKey: env('FOUNDRY_API_KEY'), baseURL: `https://${env('FOUNDRY_RESOURCE')}.openai.azure.com/openai/v1/` }));
const api = (process.argv[2] ?? 'chat_completions') as 'chat_completions' | 'responses';
setOpenAIAPI(api);

const margin = tool({
  name: 'margin_change',
  description: 'Margin for a client in a month',
  parameters: z.object({ client: z.string(), month: z.string() }),
  execute: async ({ client, month }) => ({ client, month, margin: 0.12, supplierPriceChange: '+9%' }),
});
const agent = new Agent({ name: 'Qaid', model: 'gpt-6-astra', instructions: 'Get numbers only from tools. Name the client and month.', tools: [margin] });
run(agent, 'Why did Mona margin drop in 2026-10?').then(
  (r) => console.log(api, '->', r.finalOutput),
  (e) => console.log(api, 'ERR', String(e.message ?? e).slice(0, 300)),
);
