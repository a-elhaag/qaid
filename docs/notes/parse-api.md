# Foundry endpoints (verified live 2026-10-02)

Resource: `qaid` (AIServices, S0) in resource group `qaid`, region uaenorth, subscription "Main Visual Studio Enterprise Subscription". Project: `qaid-project`.
Deployments (Global Standard): `gpt-6-astra` (100), `cohere-parse-v5` (1).

## GPT-6 (OpenAI v1 route, no api-version needed)
POST https://qaid.openai.azure.com/openai/v1/chat/completions
Header: `api-key: <key>`. Body: `{"model":"gpt-6-astra","messages":[...],"max_completion_tokens":N}`.
In code: use the plain `OpenAI` client with `baseURL: "https://qaid.openai.azure.com/openai/v1/"` and `apiKey`, `model: "gpt-6-astra"`. (AzureOpenAI + apiVersion is not needed.)

## Cohere Parse v5
POST https://qaid.services.ai.azure.com/providers/cohere/v2/parse
Header: `api-key: <key>` (same account key). `model` is the DEPLOYMENT name `cohere-parse-v5` (NOT `parse-v5.0`, that returns DeploymentNotFound).
Body: `{"model":"cohere-parse-v5","document":{"type":"image_url","image_url":"data:image/jpeg;base64,<b64>"},"output_format":"markdown"}`
Accepted images: PNG, JPEG, WebP, GIF only. PDFs and document_url are rejected (400).
Response 200: `{"id":..., "pages":[{"index":0,"type":"markdown","markdown":{"content":"<html table markup>"}}], "meta":{"billed_units":{"pages":1}}}`
Markdown content arrives as HTML table markup (`<table><tr><td>..`), fine as LLM input. Take text from `pages[*].markdown.content`, join pages with newlines.

## Parse via the Cohere SDK (verified live, used in code)
`npm i cohere-ai` (v8). Auth is Bearer with the account key; `environment` is the Foundry provider base.
```ts
import { CohereClientV2 } from 'cohere-ai';
const co = new CohereClientV2({ token: FOUNDRY_API_KEY, environment: `https://${FOUNDRY_RESOURCE}.services.ai.azure.com/providers/cohere` });
const r = await co.parse({ model: 'cohere-parse-v5', document: { type: 'image_url', imageUrl: `data:image/jpeg;base64,${b64}` }, outputFormat: 'markdown' });
const markdown = r.pages.map((p) => p.markdown.content).join('\n'); // ParseResponse.pages[].markdown.content
```
Smoke test: `npx tsx scripts/smoke-parse.ts <image.jpg>`.
