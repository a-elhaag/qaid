export type JobKind = 'extract' | 'categorise' | 'chat' | 'draft' | 'vision';

const req = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

/** Groq, OpenAI-compatible. Text jobs run gpt-oss (strict JSON schema); vision jobs (OCR and the image lane) run Qwen. */
export function route(job: JobKind) {
  const model = {
    extract: process.env.MODEL_EXTRACT ?? 'openai/gpt-oss-120b',
    categorise: process.env.MODEL_EXTRACT ?? 'openai/gpt-oss-120b',
    chat: process.env.MODEL_CHAT ?? 'openai/gpt-oss-120b',
    draft: process.env.MODEL_CHAT ?? 'openai/gpt-oss-120b',
    vision: process.env.MODEL_VISION ?? 'qwen/qwen3.8-27b',
  }[job];
  return { model, apiKey: req('GROQ_API_KEY'), baseURL: 'https://api.groq.com/openai/v1' };
}
