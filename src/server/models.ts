export type JobKind = 'extract' | 'categorise' | 'chat' | 'draft' | 'parse';

const req = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

export function route(job: JobKind) {
  const resource = req('FOUNDRY_RESOURCE');
  const model = {
    extract: process.env.MODEL_EXTRACT ?? 'gpt-6.1-sol',
    categorise: process.env.MODEL_EXTRACT ?? 'gpt-6.1-sol',
    chat: process.env.MODEL_CHAT ?? 'gpt-6-astra',
    draft: process.env.MODEL_CHAT ?? 'gpt-6-astra',
    parse: process.env.MODEL_PARSE ?? 'cohere-parse-v5',
  }[job];
  return {
    model,
    apiKey: req('FOUNDRY_API_KEY'),
    openaiBaseURL: `https://${resource}.openai.azure.com/openai/v1/`,
    cohereBaseURL: `https://${resource}.services.ai.azure.com/providers/cohere`,
  };
}
