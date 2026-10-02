# Qaid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Qaid: a client snaps a receipt on a phone, it appears on the accountant's board seconds later as filed, checked data, with chaser, agent chat and month-end pack (PDF + Excel).

**Architecture:** One Next.js app on Vercel. Backend lives in `src/server/` (only place with DB and AI keys). All logic that decides numbers lives in `src/brain/` as pure TypeScript (no Next, no Supabase), fully unit tested. Receipts are read by two parallel lanes (Cohere Parse v5 then GPT-6, and GPT-6 vision), reconciled by deterministic `fuse()`. Background work uses a Postgres `jobs` table run by `after()` and retried by a cron sweep. Supabase gives Postgres, private Storage and Realtime.

**Tech Stack:** Next.js (App Router, TypeScript, Tailwind), Vitest, Supabase JS, `openai` SDK (AzureOpenAI client) for GPT-6 on Azure AI Foundry, Cohere Parse v5 on Foundry (HTTP), exceljs, @react-pdf/renderer, zod.

**Spec:** `docs/superpowers/specs/2026-10-02-qaid-architecture-design.md`. Intent source: `idea.md`.

## Global Constraints

- Qaid prepares, the accountant decides. Never claim to file, send, or submit anything. Chat and reminders only draft.
- Every number comes from deterministic code in `src/brain/ledger`. Models never produce totals, VAT, or margins that are shown as results.
- Only `confirmed` entries count in P&L, VAT, payroll, PDF, Excel.
- Every query and answer is scoped by `client_id` and a month. Client data never mixes.
- Accountant pages and APIs require a Supabase Auth session and an `office_members` row. Every server query is scoped by the caller's `officeId` from `requireOffice()`; ids sent from the browser are never trusted. Client phone links (`/c/[token]`, `POST /api/upload`) stay token-based, upload-only, no login.
- Currency is EGP only. Salary income tax is out of scope; social insurance only.
- Rates are in ONE file, `src/brain/config.ts`, each marked `// to verify`: VAT 14%, employer 18.75%, employee 11%, insurable wage 2,700 to 16,700, minimum wage 7,000, VAT registration threshold 250,000.
- Models come only from the model router `src/server/models.ts` (Amendment A1). `gpt-6.1-sol` for extract and categorise, `gpt-6-astra` for chat and draft, `cohere-parse-v5` for parse. Cost is not a constraint. Low reasoning effort on extraction. The Agents SDK and every AI SDK live in `src/server/` only, never in `brain/`.
- `brain/` imports nothing from `next`, `react` (except `brain/export/pack.tsx`), or `@supabase`. Only `server/` touches Supabase and AI keys.
- Arabic is the default UI language, RTL (`dir="rtl"`), English via cookie toggle. No emoji in UI. Calm, white, one accent colour.
- All demo data is invented and labelled so. No real customer data in the repo.
- Every commit message ends with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Build window Oct 1 to 3, 2026. Commit normally, never backdate.

## Amendments (2026-10-02, after Azure and Supabase were set up and tested live; these OVERRIDE the task text below where they conflict)

Verified facts: see `docs/notes/parse-api.md`, `scripts/smoke-parse.ts`, `scripts/smoke-agent.ts`, `scripts/smoke-structured.ts`. Env is now: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret key `sb_secret_...`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key), `FOUNDRY_RESOURCE`, `FOUNDRY_API_KEY`, `FUSION`, `CRON_SECRET`, optional `MODEL_EXTRACT`/`MODEL_CHAT`/`MODEL_PARSE`.

**A1. Model router (Task 6 `env.ts` and Task 7).** Replace the Task 6 `env.ts` getters for Azure/Cohere with `foundryResource` and `foundryKey` (from `FOUNDRY_RESOURCE`, `FOUNDRY_API_KEY`). Create `src/server/models.ts` test-first (`src/server/models.test.ts`):
```ts
export type JobKind = 'extract' | 'categorise' | 'chat' | 'draft' | 'parse';
const req = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var ${k}`); return v; };

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
```
Tests: default model per job; `MODEL_CHAT` override changes `chat` and `draft` only; missing `FOUNDRY_RESOURCE` throws; hosts contain the resource name.

**A2. Parse uses the Cohere SDK (Task 7 `parse.ts`).** `npm i cohere-ai` is already done. Implement per `docs/notes/parse-api.md`: `new CohereClientV2({ token: r.apiKey, environment: r.cohereBaseURL })` with `r = route('parse')`, `co.parse({ model: r.model, document: { type: 'image_url', imageUrl: dataUri }, outputFormat: 'markdown' })`, return `pages.map(p => p.markdown.content).join('\n')`, throw if empty. `parseToMarkdown(b64, mime, client = defaultClient)` takes an injectable client so the unit test passes a fake `{ parse: async () => ({ pages: [...] }) }`.

**A3. OpenAI SDK and Agents SDK (Tasks 5, 7, 15).**
- Task 7 `ai.ts`: replace `AzureOpenAI`/`apiVersion` with the plain client `new OpenAI({ apiKey, baseURL: route('extract').openaiBaseURL })` (exported `openai()`). `structureReceipt` and `categorise` use `openai().chat.completions.create` with `model: route('extract').model`, `reasoning_effort: 'low'`, `response_format: json_schema` (verified with vision in `smoke-structured.ts`). Delete `gptLlm`. `chatText(messages: {role:'system'|'user'|'assistant'; content:string}[])` calls chat.completions with `route('draft').model` and no tools (used by the reminder).
- Task 5: do NOT build `askLoop` or `loop.test.ts`. Create `src/brain/ask/prompt.ts` exporting `ASK_SYSTEM_PROMPT` (same text as the plan's) and keep `reminder.ts` and its test, with its own `type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string }` in place of `Msg`.
- Task 15: the agent is built with `@openai/agents` (installed). Create `src/server/agent.ts`:
```ts
import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import { ASK_SYSTEM_PROMPT } from '@/brain/ask/prompt';
import { openai } from './ai';
import { route } from './models';
import { buildTools } from './askTools';
import { monthKey } from './queries';

let ready = false;
function setup() {
  if (ready) return;
  setTracingDisabled(true); // no traces to the OpenAI platform
  setDefaultOpenAIClient(openai('chat')); // Responses API is the default and is what GPT-6 needs for tools
  ready = true;
}

export async function askAgent(officeId: string, messages: { role: 'user' | 'assistant'; content: string }[]) {
  setup();
  const agent = new Agent({
    name: 'Qaid',
    model: route('chat').model,
    instructions: `${ASK_SYSTEM_PROMPT}\nCurrent month: ${monthKey(new Date())}.`,
    tools: buildTools(officeId),
  });
  const r = await run(agent, messages);
  return String(r.finalOutput ?? '');
}
```
(`openai(job)` takes a job kind so the chat client could be pointed at its own base URL; both use the same host today.) `askTools.ts` defines each tool with `tool({ name, description, parameters: z.object({...}), execute })` from `@openai/agents` and `zod`, calling the same deterministic code as in the plan; `resolveClient` and its test are unchanged. `src/app/api/chat/route.ts` calls `askAgent(officeId, messages)` and returns `{ answer }`. Chat Completions must NOT be used for tools (GPT-6 rejects tools with reasoning effort there). Streaming (spec) is a stretch: `run(agent, input, { stream: true })` then `toTextStream()`.

## Deviations from the spec (cut or simplified, on purpose)

- Agent chat returns the full answer in one response (no token streaming). Upgrade path: stream from `/api/chat`.
- Chat history is kept in the browser for the session. The `chat_messages` table exists but is unused. Persist per office later.
- Server-side `documents[]` multi-receipt split from Parse bounding boxes is not built. Multi-receipt is handled client-side only (Task 16). Add later if the client misses receipts.
- Email confirmation is disabled in Supabase Auth for the demo so judges can sign up instantly. Turn it on before real use. The demo account credentials are public on the login page by design (invented data only).
- Smart scan B multi-receipt detection uses a simple connected-components pass, not OpenCV.js. `// ponytail: heuristic, upgrade to a document-scanner lib if samples fail`.
- Cron sweep: Vercel Hobby crons run at most daily (unverified for this account). Retries therefore also happen in-process (Task 8) so the demo does not depend on cron.
- PDF Arabic shaping in react-pdf is unverified. PDF uses `name_en` for client names and English labels.

## Review Focus

Failure modes the spec implies but no happy-path test covers (each is pinned by a test in the owning task):

1. Arabic-Indic digits and Arabic decimal separator in a total (`١٢٣٫٥٠`): must read as 123.50. (Task 3, `normalizeDigits`/`appearsIn`)
2. Receipt with total only, no subtotal or VAT (exempt or tiny shop receipt): must not be flagged as arithmetic failure. (Task 3, `consistent`)
3. First-ever receipt for a vendor or client, no history: price jump, VAT spike and silent checks must not flag and must not divide by zero. (Task 4)
4. Same photo uploaded twice (image hash) and a different photo of the same invoice (vendor+date+total): both flag as duplicate. (Task 4, Task 9)
5. Both extraction lanes fail, or the model returns invalid JSON: job retries, then document ends `failed` with a retry path, upload never blocked. (Task 8, Task 10)
6. Accountant B opens or acts on accountant A's client, entry, document or export by id: must get 404 or no effect, never data. (Task 6A, verified in Tasks 12 and 16)
7. Open redirect through the login `next` parameter, and a signed-in user with no office membership. (Task 6A)

---

## File Structure

```
package.json  vitest.config.ts  .env.example  vercel.json
supabase/migrations/0001_init.sql
src/brain/config.ts                 rates, categories, thresholds
src/brain/types.ts                  Entry, Extracted, Fused, Flag
src/brain/ledger/index.ts           vatSummary, profitAndLoss, payroll, marginDrop
src/brain/extract/digits.ts         normalizeDigits, appearsIn
src/brain/extract/fuse.ts           fuse()
src/brain/checks/index.ts           duplicates, price jump, VAT spike
src/brain/status.ts                 client status, missing, silent
src/brain/ask/loop.ts               generic tool-calling loop (LLM injected)
src/brain/draft/reminder.ts         reminder prompt builder
src/brain/export/xlsx.ts            Excel pack
src/brain/export/pack.tsx           PDF pack
src/brain/scan/quality.ts           blur, brightness (client scan A)
src/brain/scan/regions.ts           multi-receipt regions (client scan B)
src/server/env.ts  db.ts  jobs.ts  jobStore.ts  auth.ts  authRules.ts
src/lib/supabase/server.ts  browser.ts   src/lib/demo.ts   src/middleware.ts
src/app/login/page.tsx  actions.ts
src/server/ai.ts  parse.ts  extractReceipt.ts  categorise.ts
src/server/processDocument.ts  queries.ts  actions.ts  askTools.ts
src/app/layout.tsx  page.tsx  globals.css
src/app/c/[token]/page.tsx  Uploader.tsx  scan.ts
src/app/board/page.tsx  [clientId]/page.tsx  LiveRefresh.tsx  ReviewTable.tsx  Reminder.tsx
src/app/chat/page.tsx  Chat.tsx
src/app/api/upload/route.ts  jobs/sweep/route.ts  chat/route.ts  export/[clientId]/route.ts
src/i18n/dict.ts
scripts/seed.ts  scripts/score-extraction.ts  scripts/smoke-ai.ts
samples/README.md  samples/ground-truth.json  samples/*.html
```

---

### Task 1: Scaffold, test runner, git

**Files:**
- Create: project via create-next-app, `vitest.config.ts`, `.env.example`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `npm test` runs Vitest; `@/` alias maps to `src/`.

- [ ] **Step 1: Scaffold in the existing folder**

```bash
cd /Users/anas/Projects/qaid
git init
npx create-next-app@latest . --ts --tailwind --app --src-dir --eslint --use-npm --yes --import-alias "@/*"
```
If it refuses because the folder is not empty, run it in `../qaid-tmp` and move everything except `node_modules` into this folder, keeping `idea.md` and `docs/`.

- [ ] **Step 2: Install dependencies**

```bash
npm i @supabase/supabase-js openai exceljs @react-pdf/renderer zod
npm i -D vitest tsx
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 4: Add scripts to `package.json`**

Add inside `"scripts"`: `"test": "vitest run"`, `"seed": "tsx scripts/seed.ts"`, `"score": "tsx scripts/score-extraction.ts"`, `"smoke:ai": "tsx scripts/smoke-ai.ts"`.

- [ ] **Step 5: Create `.env.example`**

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_API_VERSION=
AZURE_OPENAI_DEPLOYMENT=gpt-6-astra
COHERE_PARSE_ENDPOINT=
COHERE_PARSE_KEY=
COHERE_PARSE_MODEL=parse-v5.0
FUSION=on
CRON_SECRET=
```

- [ ] **Step 6: Verify the runner works**

Create `src/brain/sanity.test.ts`:
```ts
import { expect, it } from 'vitest';
it('runs', () => expect(1 + 1).toBe(2));
```
Run: `npm test`
Expected: 1 passed. Then delete `src/brain/sanity.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app, vitest" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Types, config, ledger (all the math)

**Files:**
- Create: `src/brain/config.ts`, `src/brain/types.ts`, `src/brain/ledger/index.ts`
- Test: `src/brain/ledger/ledger.test.ts`

**Interfaces:**
- Produces:
  - `CATEGORIES`, `Category`, `RATES`, `THRESHOLDS` (config)
  - `Entry`, `Extracted`, `DocType` (types)
  - `round2(n:number):number`, `isIncome(e:Entry):boolean`
  - `vatSummary(entries:Entry[]): {outputVat:number; inputVat:number; payable:number}`
  - `profitAndLoss(entries:Entry[]): {revenue:number; expensesByCategory:Record<string,number>; totalExpenses:number; net:number; margin:number|null}`
  - `payroll(employees:{name:string; wage:number}[]): {rows:{name:string; wage:number; insurable:number; employee:number; employer:number}[]; totalEmployee:number; totalEmployer:number}`
  - `priceChanges(prev:Entry[], cur:Entry[]): {vendor:string; prevAvg:number; curAvg:number; pct:number}[]` sorted by pct descending

- [ ] **Step 1: Create `src/brain/config.ts`**

```ts
export const CATEGORIES = ['rent', 'supplies', 'sales', 'salaries', 'utilities', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

// ALL RATES TO VERIFY before the demo. Never invent a number: mark it "to verify".
export const RATES = {
  vat: 0.14, // to verify
  socialInsurance: { employer: 0.1875, employee: 0.11, minWage: 2700, maxWage: 16700 }, // to verify
  minimumWage: 7000, // to verify
  vatRegistrationThreshold: 250000, // to verify
} as const;

export const THRESHOLDS = {
  priceJump: 0.08, // flag when a vendor's total rises 8% or more vs its prior average
  vatSpike: 1.5, // flag when this month's VAT is 1.5x the prior-month average
  arithmeticTolerance: 0.01,
} as const;
```

- [ ] **Step 2: Create `src/brain/types.ts`**

```ts
import type { Category } from './config';

export type DocType = 'purchase' | 'sale' | 'payment_screenshot' | 'other';

export interface Extracted {
  vendor: string | null;
  date: string | null; // YYYY-MM-DD
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  docType: DocType;
}

export interface Entry {
  id: string;
  clientId: string;
  documentId: string | null;
  vendor: string;
  date: string; // YYYY-MM-DD
  subtotal: number;
  vat: number;
  total: number;
  category: Category;
  confirmed: boolean;
  imageHash?: string | null;
}

export type FlagKind = 'duplicate' | 'price_jump' | 'vat_spike';
export interface Flag {
  kind: FlagKind;
  entryId: string;
  detail: string;
}
```

- [ ] **Step 3: Write the failing tests `src/brain/ledger/ledger.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { payroll, priceChanges, profitAndLoss, vatSummary } from './index';
import type { Entry } from '../types';

const e = (o: Partial<Entry>): Entry => ({
  id: Math.random().toString(36).slice(2), clientId: 'c1', documentId: null, vendor: 'v',
  date: '2026-10-05', subtotal: 100, vat: 14, total: 114, category: 'supplies', confirmed: true, ...o,
});

describe('vatSummary', () => {
  it('output minus input, confirmed only', () => {
    const r = vatSummary([
      e({ category: 'sales', subtotal: 1000, vat: 140, total: 1140 }),
      e({ category: 'supplies', vat: 14 }),
      e({ category: 'supplies', vat: 99, confirmed: false }),
    ]);
    expect(r).toEqual({ outputVat: 140, inputVat: 14, payable: 126 });
  });
});

describe('profitAndLoss', () => {
  it('uses net-of-VAT subtotals and ignores unconfirmed', () => {
    const r = profitAndLoss([
      e({ category: 'sales', subtotal: 1000, vat: 140, total: 1140 }),
      e({ category: 'rent', subtotal: 300, vat: 0, total: 300 }),
      e({ category: 'supplies', subtotal: 200, vat: 28, total: 228 }),
      e({ category: 'supplies', subtotal: 5000, confirmed: false }),
    ]);
    expect(r.revenue).toBe(1000);
    expect(r.expensesByCategory).toEqual({ rent: 300, supplies: 200 });
    expect(r.totalExpenses).toBe(500);
    expect(r.net).toBe(500);
    expect(r.margin).toBe(0.5);
  });
  it('margin is null with no revenue (no divide by zero)', () => {
    expect(profitAndLoss([e({ category: 'rent', subtotal: 300 })]).margin).toBeNull();
  });
});

describe('payroll', () => {
  it('clamps wage to insurable bounds and applies rates', () => {
    const r = payroll([
      { name: 'low', wage: 2000 },
      { name: 'mid', wage: 10000 },
      { name: 'high', wage: 30000 },
    ]);
    expect(r.rows.map((x) => x.insurable)).toEqual([2700, 10000, 16700]);
    expect(r.rows[1].employee).toBe(1100);
    expect(r.rows[1].employer).toBe(1875);
    expect(r.totalEmployee).toBe(round(2700 * 0.11 + 1100 + 16700 * 0.11));
  });
});
const round = (n: number) => Math.round(n * 100) / 100;

describe('priceChanges', () => {
  it('reports per-vendor average change, biggest first', () => {
    const prev = [e({ vendor: 'A', total: 100 }), e({ vendor: 'B', total: 200 })];
    const cur = [e({ vendor: 'A', total: 109 }), e({ vendor: 'B', total: 202 })];
    const r = priceChanges(prev, cur);
    expect(r[0]).toMatchObject({ vendor: 'A', pct: 0.09 });
    expect(r[1].vendor).toBe('B');
  });
  it('ignores vendors with no previous history', () => {
    expect(priceChanges([], [e({ vendor: 'new' })])).toEqual([]);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run src/brain/ledger`
Expected: FAIL, cannot find `./index`.

- [ ] **Step 5: Implement `src/brain/ledger/index.ts`**

```ts
import { RATES } from '../config';
import type { Entry } from '../types';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const isIncome = (e: Entry) => e.category === 'sales';
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const confirmedOnly = (es: Entry[]) => es.filter((e) => e.confirmed);

export function vatSummary(entries: Entry[]) {
  const c = confirmedOnly(entries);
  const outputVat = round2(sum(c.filter(isIncome).map((e) => e.vat)));
  const inputVat = round2(sum(c.filter((e) => !isIncome(e)).map((e) => e.vat)));
  return { outputVat, inputVat, payable: round2(outputVat - inputVat) };
}

export function profitAndLoss(entries: Entry[]) {
  const c = confirmedOnly(entries);
  const revenue = round2(sum(c.filter(isIncome).map((e) => e.subtotal)));
  const expensesByCategory: Record<string, number> = {};
  for (const e of c.filter((x) => !isIncome(x))) {
    expensesByCategory[e.category] = round2((expensesByCategory[e.category] ?? 0) + e.subtotal);
  }
  const totalExpenses = round2(sum(Object.values(expensesByCategory)));
  const net = round2(revenue - totalExpenses);
  return { revenue, expensesByCategory, totalExpenses, net, margin: revenue > 0 ? round2(net / revenue) : null };
}

export function payroll(employees: { name: string; wage: number }[]) {
  const { employer, employee, minWage, maxWage } = RATES.socialInsurance;
  const rows = employees.map((p) => {
    const insurable = Math.min(Math.max(p.wage, minWage), maxWage);
    return { name: p.name, wage: p.wage, insurable, employee: round2(insurable * employee), employer: round2(insurable * employer) };
  });
  return { rows, totalEmployee: round2(sum(rows.map((r) => r.employee))), totalEmployer: round2(sum(rows.map((r) => r.employer))) };
}

const avgByVendor = (es: Entry[]) => {
  const m = new Map<string, number[]>();
  for (const e of es) m.set(e.vendor.trim().toLowerCase(), [...(m.get(e.vendor.trim().toLowerCase()) ?? []), e.total]);
  return new Map([...m].map(([k, v]) => [k, sum(v) / v.length]));
};

export function priceChanges(prev: Entry[], cur: Entry[]) {
  const p = avgByVendor(prev);
  const names = new Map(cur.map((e) => [e.vendor.trim().toLowerCase(), e.vendor]));
  const out: { vendor: string; prevAvg: number; curAvg: number; pct: number }[] = [];
  for (const [k, curAvg] of avgByVendor(cur)) {
    const prevAvg = p.get(k);
    if (!prevAvg) continue;
    out.push({ vendor: names.get(k)!, prevAvg: round2(prevAvg), curAvg: round2(curAvg), pct: round2((curAvg - prevAvg) / prevAvg) });
  }
  return out.sort((a, b) => b.pct - a.pct);
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/brain/ledger`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/brain && git commit -m "feat(brain): types, rates config, ledger math" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Fusion (`digits`, `fuse`)

**Files:**
- Create: `src/brain/extract/digits.ts`, `src/brain/extract/fuse.ts`
- Test: `src/brain/extract/fuse.test.ts`

**Interfaces:**
- Consumes: `Extracted`, `DocType` from `../types`, `THRESHOLDS` from `../config`.
- Produces:
  - `normalizeDigits(s:string):string` (Arabic-Indic and Persian digits to ASCII, `٫` to `.`, `٬` to `,`)
  - `appearsIn(markdown:string, field:'vendor'|'date'|'subtotal'|'vat'|'total', value:string|number):boolean`
  - `type Agreement = 'agree'|'resolved'|'disputed'|'single'`
  - `interface FusedField { value: string|number|null; agreement: Agreement; candidates: (string|number)[] }`
  - `interface Fused { fields: Record<'vendor'|'date'|'subtotal'|'vat'|'total', FusedField>; docType: DocType; confidence: 'high'|'medium'|'low'; disputed: string[]; arithmeticOk: boolean }`
  - `fuse(a: Extracted|null, b: Extracted|null, parseMarkdown: string|null): Fused` (throws `Error('both lanes failed')` when both null)

- [ ] **Step 1: Write the failing tests `src/brain/extract/fuse.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { appearsIn, normalizeDigits } from './digits';
import { fuse } from './fuse';
import type { Extracted } from '../types';

const x = (o: Partial<Extracted> = {}): Extracted => ({
  vendor: 'Spinneys', date: '2026-10-05', subtotal: 100, vat: 14, total: 114, docType: 'purchase', ...o,
});

describe('normalizeDigits', () => {
  it('converts Arabic-Indic digits and decimal separator', () => {
    expect(normalizeDigits('١٢٣٫٥٠')).toBe('123.50');
    expect(normalizeDigits('۱۲۳')).toBe('123');
  });
});

describe('appearsIn', () => {
  it('finds amounts written with Arabic digits', () => {
    expect(appearsIn('الإجمالي ١١٤٫٠٠ ج.م', 'total', 114)).toBe(true);
  });
  it('does not match inside a longer number', () => {
    expect(appearsIn('total 1140.00', 'total', 114)).toBe(false);
  });
  it('finds dates in dd/mm/yyyy', () => {
    expect(appearsIn('Date: 05/10/2026', 'date', '2026-10-05')).toBe(true);
  });
});

describe('fuse', () => {
  it('both agree: high confidence', () => {
    const r = fuse(x(), x(), 'md');
    expect(r.confidence).toBe('high');
    expect(r.fields.total.agreement).toBe('agree');
    expect(r.disputed).toEqual([]);
  });

  it('lanes differ: arithmetic picks the consistent lane', () => {
    const r = fuse(x({ total: 144 }), x({ total: 114 }), null); // lane A total is wrong
    expect(r.fields.total.value).toBe(114);
    expect(r.fields.total.agreement).toBe('resolved');
    expect(r.confidence).toBe('medium');
  });

  it('lanes differ, arithmetic cannot decide: literal in Parse markdown decides', () => {
    const a = x({ vendor: 'Spinney', total: null, subtotal: null, vat: null });
    const b = x({ vendor: 'Spinneys', total: null, subtotal: null, vat: null });
    const r = fuse(a, b, 'Welcome to Spinneys store');
    expect(r.fields.vendor.value).toBe('Spinneys');
    expect(r.fields.vendor.agreement).toBe('resolved');
  });

  it('truly disputed: keeps both candidates, defaults to lane A, low confidence', () => {
    const a = x({ vendor: 'Alpha', subtotal: null, vat: null, total: null });
    const b = x({ vendor: 'Beta', subtotal: null, vat: null, total: null });
    const r = fuse(a, b, 'no names here');
    expect(r.fields.vendor.agreement).toBe('disputed');
    expect(r.fields.vendor.candidates).toEqual(['Alpha', 'Beta']);
    expect(r.fields.vendor.value).toBe('Alpha');
    expect(r.disputed).toContain('vendor');
    expect(r.confidence).toBe('low');
  });

  it('one lane failed: uses the other, medium confidence, never throws', () => {
    const r = fuse(null, x(), null);
    expect(r.fields.total.value).toBe(114);
    expect(r.fields.total.agreement).toBe('single');
    expect(r.confidence).toBe('medium');
  });

  it('both lanes failed throws', () => {
    expect(() => fuse(null, null, null)).toThrow('both lanes failed');
  });

  it('total-only receipt (no subtotal or VAT) is not an arithmetic failure', () => {
    const t = x({ subtotal: null, vat: null, total: 50 });
    const r = fuse(t, t, null);
    expect(r.arithmeticOk).toBe(true);
    expect(r.confidence).toBe('high');
  });

  it('agreed but arithmetic wrong: low confidence', () => {
    const bad = x({ subtotal: 100, vat: 14, total: 200 });
    const r = fuse(bad, bad, null);
    expect(r.arithmeticOk).toBe(false);
    expect(r.confidence).toBe('low');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/brain/extract`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/brain/extract/digits.ts`**

```ts
const MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٫': '.', '٬': ',',
};

export const normalizeDigits = (s: string) => s.replace(/[٠-٩۰-۹٫٬]/g, (c) => MAP[c] ?? c);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function dateForms(iso: string): string[] {
  const [y, m, d] = iso.split('-');
  const dn = String(Number(d));
  const mn = String(Number(m));
  return [iso, `${d}/${m}/${y}`, `${d}-${m}-${y}`, `${dn}/${mn}/${y}`, `${dn}-${mn}-${y}`, `${y}/${m}/${d}`];
}

export function appearsIn(
  markdown: string,
  field: 'vendor' | 'date' | 'subtotal' | 'vat' | 'total',
  value: string | number,
): boolean {
  const text = normalizeDigits(markdown);
  if (field === 'vendor') return text.toLowerCase().includes(String(value).toLowerCase());
  if (field === 'date') return dateForms(String(value)).some((f) => text.includes(f));
  const n = Number(value);
  const flat = text.replace(/(\d),(?=\d{3}\b)/g, '$1'); // drop thousands commas
  return [n.toFixed(2), String(n)].some((s) => new RegExp(`(?<![\\d.])${esc(s)}(?!\\d)`).test(flat));
}
```

- [ ] **Step 4: Implement `src/brain/extract/fuse.ts`**

```ts
import { THRESHOLDS } from '../config';
import type { DocType, Extracted } from '../types';
import { appearsIn } from './digits';

type Field = 'vendor' | 'date' | 'subtotal' | 'vat' | 'total';
type Value = string | number;
export type Agreement = 'agree' | 'resolved' | 'disputed' | 'single';
export interface FusedField { value: Value | null; agreement: Agreement; candidates: Value[] }
export interface Fused {
  fields: Record<Field, FusedField>;
  docType: DocType;
  confidence: 'high' | 'medium' | 'low';
  disputed: string[];
  arithmeticOk: boolean;
}

const FIELDS: Field[] = ['vendor', 'date', 'subtotal', 'vat', 'total'];
const NUMERIC = new Set<Field>(['subtotal', 'vat', 'total']);

const norm = (v: Value | null) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') : v);
const same = (a: Value | null, b: Value | null) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.005 : norm(a) === norm(b);

/** Unknown (any null) counts as consistent: total-only receipts are valid. */
function consistent(e: Extracted): boolean {
  if (e.subtotal == null || e.vat == null || e.total == null) return true;
  return Math.abs(e.subtotal + e.vat - e.total) <= THRESHOLDS.arithmeticTolerance;
}

export function fuse(a: Extracted | null, b: Extracted | null, parseMarkdown: string | null): Fused {
  if (!a && !b) throw new Error('both lanes failed');
  const both = !!a && !!b;
  const trioA = a ? consistent(a) : true;
  const trioB = b ? consistent(b) : true;
  const fields = {} as Record<Field, FusedField>;

  for (const f of FIELDS) {
    const va = (a?.[f] ?? null) as Value | null;
    const vb = (b?.[f] ?? null) as Value | null;
    if (!both) {
      const v = va ?? vb;
      fields[f] = { value: v, agreement: 'single', candidates: v == null ? [] : [v] };
      continue;
    }
    if (same(va, vb)) {
      fields[f] = { value: va, agreement: 'agree', candidates: va == null ? [] : [va] };
      continue;
    }
    const candidates = [va, vb].filter((v): v is Value => v != null);
    let pick: Value | null | undefined;
    if (NUMERIC.has(f) && trioA !== trioB) pick = trioA ? va : vb; // arithmetic decides
    else if (parseMarkdown) {
      const hits = candidates.filter((c) => appearsIn(parseMarkdown, f, c));
      if (hits.length === 1) pick = hits[0];
    }
    fields[f] =
      pick != null
        ? { value: pick, agreement: 'resolved', candidates }
        : { value: va ?? vb, agreement: 'disputed', candidates };
  }

  const num = (f: Field) => fields[f].value as number | null;
  const arithmeticOk = consistent({
    vendor: null, date: null, subtotal: num('subtotal'), vat: num('vat'), total: num('total'), docType: 'other',
  });
  const disputed = FIELDS.filter((f) => fields[f].agreement === 'disputed');
  const anyResolved = FIELDS.some((f) => fields[f].agreement === 'resolved');
  const confidence: Fused['confidence'] =
    disputed.length || !arithmeticOk ? 'low' : !both || anyResolved ? 'medium' : 'high';

  return { fields, docType: (a?.docType ?? b?.docType) as DocType, confidence, disputed, arithmeticOk };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/brain/extract`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/brain && git commit -m "feat(brain): two-lane fusion with arithmetic and literal checks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Checks and board status

**Files:**
- Create: `src/brain/checks/index.ts`, `src/brain/status.ts`
- Test: `src/brain/checks/checks.test.ts`, `src/brain/status.test.ts`

**Interfaces:**
- Consumes: `Entry`, `Flag` from `../types`; `THRESHOLDS` from `../config`.
- Produces:
  - `findDuplicates(entry:Entry, others:Entry[]): Flag[]` (same client, same image hash, or same vendor+date+total; ignores itself)
  - `findPriceJump(entry:Entry, history:Entry[]): Flag | null` (history = same client, same vendor, earlier date)
  - `findVatSpike(entryId:string, thisMonthVat:number, priorMonthVats:number[]): Flag | null`
  - `type ClientStatus = 'strange'|'missing'|'silent'|'review'|'ready'`
  - `clientStatus(i:{openFlags:number; missing:number; silent:boolean; needsReview:number}): ClientStatus`
  - `missingExpected(expectedVendors:string[], monthVendors:string[]): string[]`
  - `isSilent(uploadsThisMonth:number, priorMonthUploads:number[]): boolean`

- [ ] **Step 1: Write failing tests `src/brain/checks/checks.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { findDuplicates, findPriceJump, findVatSpike } from './index';
import type { Entry } from '../types';

const e = (o: Partial<Entry>): Entry => ({
  id: 'x', clientId: 'c1', documentId: null, vendor: 'Gulf Supplies', date: '2026-10-05',
  subtotal: 100, vat: 14, total: 114, category: 'supplies', confirmed: false, ...o,
});

describe('findDuplicates', () => {
  it('flags same vendor+date+total on another entry', () => {
    const f = findDuplicates(e({ id: 'new' }), [e({ id: 'old' })]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: 'duplicate', entryId: 'new' });
  });
  it('flags same image hash even if fields differ', () => {
    const f = findDuplicates(e({ id: 'new', imageHash: 'h', total: 1 }), [e({ id: 'old', imageHash: 'h' })]);
    expect(f).toHaveLength(1);
  });
  it('ignores itself and other clients', () => {
    expect(findDuplicates(e({ id: 'a' }), [e({ id: 'a' }), e({ id: 'b', clientId: 'c2' })])).toEqual([]);
  });
});

describe('findPriceJump', () => {
  const hist = [e({ id: 'h1', date: '2026-08-05', total: 100 }), e({ id: 'h2', date: '2026-09-05', total: 100 })];
  it('flags a 9% rise', () => {
    const f = findPriceJump(e({ id: 'n', total: 109 }), hist);
    expect(f?.kind).toBe('price_jump');
    expect(f?.detail).toContain('9%');
  });
  it('does not flag a 3% rise', () => {
    expect(findPriceJump(e({ id: 'n', total: 103 }), hist)).toBeNull();
  });
  it('no history: no flag, no crash', () => {
    expect(findPriceJump(e({ id: 'n' }), [])).toBeNull();
  });
});

describe('findVatSpike', () => {
  it('flags 2x the prior average', () => {
    expect(findVatSpike('n', 200, [100, 100])?.kind).toBe('vat_spike');
  });
  it('no prior months: no flag', () => {
    expect(findVatSpike('n', 200, [])).toBeNull();
    expect(findVatSpike('n', 200, [0, 0])).toBeNull();
  });
  it('normal month: no flag', () => {
    expect(findVatSpike('n', 110, [100, 100])).toBeNull();
  });
});
```

`src/brain/status.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clientStatus, isSilent, missingExpected } from './status';

describe('clientStatus priority', () => {
  const base = { openFlags: 0, missing: 0, silent: false, needsReview: 0 };
  it('ready when nothing pending', () => expect(clientStatus(base)).toBe('ready'));
  it('review', () => expect(clientStatus({ ...base, needsReview: 2 })).toBe('review'));
  it('silent beats review', () => expect(clientStatus({ ...base, silent: true, needsReview: 2 })).toBe('silent'));
  it('missing beats silent', () => expect(clientStatus({ ...base, missing: 1, silent: true })).toBe('missing'));
  it('strange beats everything', () =>
    expect(clientStatus({ openFlags: 1, missing: 1, silent: true, needsReview: 1 })).toBe('strange'));
});

describe('missingExpected', () => {
  it('lists expected vendors not seen this month, case-insensitive', () => {
    expect(missingExpected(['Landlord', 'Gulf Supplies'], ['gulf supplies'])).toEqual(['Landlord']);
  });
});

describe('isSilent', () => {
  it('silent only if zero uploads now and uploads in prior months', () => {
    expect(isSilent(0, [4, 5])).toBe(true);
    expect(isSilent(1, [4, 5])).toBe(false);
  });
  it('a brand-new client with no history is not silent', () => {
    expect(isSilent(0, [])).toBe(false);
    expect(isSilent(0, [0, 0])).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/brain/checks src/brain/status.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/brain/checks/index.ts`**

```ts
import { THRESHOLDS } from '../config';
import type { Entry, Flag } from '../types';

const key = (s: string) => s.trim().toLowerCase();

export function findDuplicates(entry: Entry, others: Entry[]): Flag[] {
  const dup = others.filter(
    (o) =>
      o.id !== entry.id &&
      o.clientId === entry.clientId &&
      ((entry.imageHash && o.imageHash === entry.imageHash) ||
        (key(o.vendor) === key(entry.vendor) && o.date === entry.date && Math.abs(o.total - entry.total) < 0.005)),
  );
  return dup.length ? [{ kind: 'duplicate', entryId: entry.id, detail: `Same as ${dup[0].vendor} ${dup[0].date} ${dup[0].total}` }] : [];
}

export function findPriceJump(entry: Entry, history: Entry[]): Flag | null {
  if (!history.length) return null;
  const avg = history.reduce((s, h) => s + h.total, 0) / history.length;
  if (avg <= 0) return null;
  const pct = (entry.total - avg) / avg;
  if (pct < THRESHOLDS.priceJump) return null;
  return { kind: 'price_jump', entryId: entry.id, detail: `${entry.vendor} up ${Math.round(pct * 100)}% vs prior average ${avg.toFixed(2)}` };
}

export function findVatSpike(entryId: string, thisMonthVat: number, priorMonthVats: number[]): Flag | null {
  if (!priorMonthVats.length) return null;
  const avg = priorMonthVats.reduce((a, b) => a + b, 0) / priorMonthVats.length;
  if (avg <= 0 || thisMonthVat < avg * THRESHOLDS.vatSpike) return null;
  return { kind: 'vat_spike', entryId, detail: `VAT ${thisMonthVat.toFixed(2)} vs prior average ${avg.toFixed(2)}` };
}
```

- [ ] **Step 4: Implement `src/brain/status.ts`**

```ts
export type ClientStatus = 'strange' | 'missing' | 'silent' | 'review' | 'ready';

export function clientStatus(i: { openFlags: number; missing: number; silent: boolean; needsReview: number }): ClientStatus {
  if (i.openFlags > 0) return 'strange';
  if (i.missing > 0) return 'missing';
  if (i.silent) return 'silent';
  if (i.needsReview > 0) return 'review';
  return 'ready';
}

export function missingExpected(expectedVendors: string[], monthVendors: string[]): string[] {
  const seen = new Set(monthVendors.map((v) => v.trim().toLowerCase()));
  return expectedVendors.filter((v) => !seen.has(v.trim().toLowerCase()));
}

// ponytail: no day-of-month guard, so every client looks silent on the 1st if they have not uploaded yet.
export function isSilent(uploadsThisMonth: number, priorMonthUploads: number[]): boolean {
  if (uploadsThisMonth > 0 || !priorMonthUploads.length) return false;
  return priorMonthUploads.reduce((a, b) => a + b, 0) / priorMonthUploads.length >= 1;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/brain`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/brain && git commit -m "feat(brain): duplicate, price jump, VAT spike checks and board status" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ask loop and reminder prompt (pure)

**Files:**
- Create: `src/brain/ask/loop.ts`, `src/brain/draft/reminder.ts`
- Test: `src/brain/ask/loop.test.ts`, `src/brain/draft/reminder.test.ts`

**Interfaces:**
- Produces:
  - `type Msg = {role:'system'|'user'|'assistant'|'tool'; content:string|null; toolCalls?:ToolCall[]; toolCallId?:string}`
  - `type ToolCall = {id:string; name:string; args:unknown}`
  - `interface ToolDef { name:string; description:string; parameters:object; run:(args:any)=>Promise<unknown> }`
  - `interface Llm { chat(messages:Msg[], tools:Pick<ToolDef,'name'|'description'|'parameters'>[]): Promise<{content:string|null; toolCalls:ToolCall[]}> }`
  - `askLoop(llm:Llm, tools:ToolDef[], history:Msg[], maxSteps?:number): Promise<{answer:string; toolsUsed:string[]}>`
  - `ASK_SYSTEM_PROMPT: string`
  - `buildReminderMessages(i:{clientName:string; month:string; missing:string[]}): Msg[]`

- [ ] **Step 1: Write failing tests `src/brain/ask/loop.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { askLoop, type Llm, type ToolDef } from './loop';

const tool = (run: ToolDef['run']): ToolDef => ({ name: 't', description: 'd', parameters: { type: 'object', properties: {} }, run });

describe('askLoop', () => {
  it('runs a tool then returns the final answer', async () => {
    const calls: unknown[] = [];
    const llm: Llm = {
      async chat(messages) {
        const hasTool = messages.some((m) => m.role === 'tool');
        return hasTool
          ? { content: 'Mona: margin 12%', toolCalls: [] }
          : { content: null, toolCalls: [{ id: '1', name: 't', args: { month: '2026-10' } }] };
      },
    };
    const r = await askLoop(llm, [tool(async (a) => (calls.push(a), { margin: 0.12 }))], [{ role: 'user', content: 'q' }]);
    expect(r.answer).toBe('Mona: margin 12%');
    expect(r.toolsUsed).toEqual(['t']);
    expect(calls).toEqual([{ month: '2026-10' }]);
  });

  it('a throwing tool becomes a tool message, loop continues', async () => {
    let sawError = false;
    const llm: Llm = {
      async chat(messages) {
        const t = messages.find((m) => m.role === 'tool');
        if (t) { sawError = (t.content ?? '').includes('error'); return { content: 'I do not have enough information.', toolCalls: [] }; }
        return { content: null, toolCalls: [{ id: '1', name: 't', args: {} }] };
      },
    };
    const r = await askLoop(llm, [tool(async () => { throw new Error('boom'); })], [{ role: 'user', content: 'q' }]);
    expect(sawError).toBe(true);
    expect(r.answer).toContain('enough information');
  });

  it('unknown tool name is reported back, not crashed', async () => {
    const llm: Llm = {
      async chat(messages) {
        return messages.some((m) => m.role === 'tool')
          ? { content: 'done', toolCalls: [] }
          : { content: null, toolCalls: [{ id: '1', name: 'nope', args: {} }] };
      },
    };
    expect((await askLoop(llm, [], [{ role: 'user', content: 'q' }])).answer).toBe('done');
  });

  it('stops after maxSteps with a safe answer', async () => {
    const llm: Llm = { async chat() { return { content: null, toolCalls: [{ id: '1', name: 't', args: {} }] }; } };
    const r = await askLoop(llm, [tool(async () => 1)], [{ role: 'user', content: 'q' }], 3);
    expect(r.answer).toContain('enough information');
  });
});
```

`src/brain/draft/reminder.test.ts`:
```ts
import { expect, it } from 'vitest';
import { buildReminderMessages } from './reminder';

it('lists exactly the missing items and forbids inventing', () => {
  const m = buildReminderMessages({ clientName: 'كافيه النيل', month: '2026-10', missing: ['إيصال الإيجار', 'فاتورة المورد'] });
  const all = m.map((x) => x.content).join('\n');
  expect(all).toContain('إيصال الإيجار');
  expect(all).toContain('فاتورة المورد');
  expect(all).toContain('كافيه النيل');
  expect(all).toMatch(/do not add|لا تضف/i);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/brain/ask src/brain/draft`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/brain/ask/loop.ts`**

```ts
export type ToolCall = { id: string; name: string; args: unknown };
export type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; toolCalls?: ToolCall[]; toolCallId?: string };
export interface ToolDef {
  name: string;
  description: string;
  parameters: object;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (args: any) => Promise<unknown>;
}
export interface Llm {
  chat(
    messages: Msg[],
    tools: Pick<ToolDef, 'name' | 'description' | 'parameters'>[],
  ): Promise<{ content: string | null; toolCalls: ToolCall[] }>;
}

export const ASK_SYSTEM_PROMPT = `You are Qaid, an assistant for an accountant at a small Egyptian accounting office.
Rules:
- Qaid prepares, the accountant decides. Never say you filed, sent, paid or submitted anything.
- Get every number from a tool. Never compute or guess numbers yourself.
- Every answer must name the client and the month it is about.
- If tools return nothing useful, answer exactly that you do not have enough information.
- Answer in the language the user wrote in (Arabic or English). Be short.`;

const SAFE = 'I do not have enough information to answer that.';

export async function askLoop(llm: Llm, tools: ToolDef[], history: Msg[], maxSteps = 6) {
  const messages: Msg[] = [...history];
  const toolsUsed: string[] = [];
  const specs = tools.map(({ name, description, parameters }) => ({ name, description, parameters }));

  for (let step = 0; step < maxSteps; step++) {
    const r = await llm.chat(messages, specs);
    if (!r.toolCalls.length) return { answer: r.content ?? SAFE, toolsUsed };
    messages.push({ role: 'assistant', content: r.content, toolCalls: r.toolCalls });
    for (const call of r.toolCalls) {
      toolsUsed.push(call.name);
      const def = tools.find((t) => t.name === call.name);
      let out: unknown;
      try {
        out = def ? await def.run(call.args) : { error: `unknown tool ${call.name}` };
      } catch (err) {
        out = { error: String(err) };
      }
      messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(out) });
    }
  }
  return { answer: SAFE, toolsUsed };
}
```

- [ ] **Step 4: Implement `src/brain/draft/reminder.ts`**

```ts
import type { Msg } from '../ask/loop';

export function buildReminderMessages(i: { clientName: string; month: string; missing: string[] }): Msg[] {
  return [
    {
      role: 'system',
      content:
        'You write short, polite WhatsApp-style reminders in Egyptian Arabic from an accounting office to a small business owner. ' +
        'List exactly the missing items given. Do not add items, amounts, deadlines or threats. Do not claim anything was filed or paid. Two to four lines.',
    },
    {
      role: 'user',
      content: `Client: ${i.clientName}\nMonth: ${i.month}\nMissing:\n${i.missing.map((m) => `- ${m}`).join('\n')}`,
    },
  ];
}
```
(The test regex also accepts the English phrase "Do not add".)

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/brain`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/brain && git commit -m "feat(brain): tool-calling ask loop and reminder prompt" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Database schema

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `src/server/env.ts`, `src/server/db.ts`

**Interfaces:**
- Produces: tables `offices, office_members, clients, documents, entries, expected_docs, flags, employees, jobs, chat_messages`; SQL functions `claim_job()` and `my_office_ids()`; office-scoped RLS read policies; `db()` returns a service-role Supabase client; `env` object with typed vars.

- [ ] **Step 1: Create `supabase/migrations/0001_init.sql`**

```sql
create extension if not exists pgcrypto;

create table offices (id uuid primary key default gen_random_uuid(), name text not null);

create table clients (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices on delete cascade,
  name text not null,
  name_en text not null,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  image_path text,
  image_hash text,
  batch_id uuid,
  status text not null default 'received' check (status in ('received','extracting','needs_review','confirmed','failed')),
  error text,
  created_at timestamptz not null default now()
);
create index on documents (client_id, created_at);
create index on documents (image_hash);

create table entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  document_id uuid references documents on delete set null,
  vendor text not null default '',
  entry_date date not null,
  subtotal numeric(14,2) not null default 0,
  vat numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  category text not null default 'other' check (category in ('rent','supplies','sales','salaries','utilities','other')),
  category_confidence numeric(3,2),
  question text,
  agreement jsonb not null default '{}',
  confidence text not null default 'high',
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on entries (client_id, entry_date);

create table expected_docs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  vendor text not null,
  label text not null
);

create table flags (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  entry_id uuid references entries on delete cascade,
  kind text not null,
  detail text not null,
  open boolean not null default true,
  created_at timestamptz not null default now()
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  name text not null,
  monthly_wage numeric(12,2) not null
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','retry','done','dead')),
  attempts int not null default 0,
  error text,
  run_at timestamptz not null default now(),
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function claim_job() returns jobs language plpgsql as $$
declare j jobs;
begin
  select * into j from jobs
   where (status in ('queued','retry') and run_at <= now())
      or (status = 'running' and started_at < now() - interval '2 minutes')
   order by run_at limit 1 for update skip locked;
  if not found then return null; end if;
  update jobs set status = 'running', attempts = attempts + 1, started_at = now() where id = j.id returning * into j;
  return j;
end $$;

create table office_members (
  user_id uuid not null references auth.users on delete cascade,
  office_id uuid not null references offices on delete cascade,
  primary key (user_id, office_id)
);

create or replace function my_office_ids() returns setof uuid
language sql security definer stable set search_path = public as $$
  select office_id from office_members where user_id = auth.uid()
$$;

-- Reads run under the signed-in user's JWT (needed so Realtime only streams their own rows).
-- Writes go through server code with the service key after an ownership check.
alter publication supabase_realtime add table documents, entries, flags;
alter table offices enable row level security;
alter table office_members enable row level security;
alter table clients enable row level security;
alter table documents enable row level security;
alter table entries enable row level security;
alter table flags enable row level security;
create policy own_member on office_members for select using (user_id = auth.uid());
create policy own_office on offices for select using (id in (select my_office_ids()));
create policy own_clients on clients for select using (office_id in (select my_office_ids()));
create policy own_documents on documents for select using (client_id in (select id from clients where office_id in (select my_office_ids())));
create policy own_entries on entries for select using (client_id in (select id from clients where office_id in (select my_office_ids())));
create policy own_flags on flags for select using (client_id in (select id from clients where office_id in (select my_office_ids())));

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict do nothing;
```

- [ ] **Step 2: Apply it**

Create a Supabase project, open SQL editor, run the file. (Or `supabase db push` if the CLI is linked.)
Expected: no errors. In Table Editor, confirm the 10 tables exist and bucket `receipts` is private. In Authentication settings, enable Email provider and turn OFF "Confirm email" (demo only).

- [ ] **Step 3: Create `src/server/env.ts`**

```ts
const req = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

export const env = {
  get supabaseUrl() { return req('SUPABASE_URL'); },
  get serviceKey() { return req('SUPABASE_SERVICE_ROLE_KEY'); },
  get aoaiEndpoint() { return req('AZURE_OPENAI_ENDPOINT'); },
  get aoaiKey() { return req('AZURE_OPENAI_API_KEY'); },
  get aoaiVersion() { return req('AZURE_OPENAI_API_VERSION'); },
  get deployment() { return process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-6-astra'; },
  get parseEndpoint() { return req('COHERE_PARSE_ENDPOINT'); },
  get parseKey() { return req('COHERE_PARSE_KEY'); },
  get parseModel() { return process.env.COHERE_PARSE_MODEL ?? 'parse-v5.0'; },
  get fusion() { return (process.env.FUSION ?? 'on') === 'on'; },
  get cronSecret() { return req('CRON_SECRET'); },
};
```

- [ ] **Step 4: Create `src/server/db.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;
export const db = () => (client ??= createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } }));
```

- [ ] **Step 5: Smoke check connection**

Create `.env.local` from `.env.example` with real Supabase values, then:
```bash
npx tsx -e "import('./src/server/db').then(async m=>{const r=await m.db().from('offices').select('*');console.log(r)})"
```
Expected: `{ data: [], error: null, ... }`.

- [ ] **Step 6: Commit**

```bash
git add supabase src/server && git commit -m "feat: database schema, claim_job, env and db client" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6A: Accountant auth (Supabase Auth, office membership)

**Files:**
- Create: `src/server/authRules.ts`, `src/server/auth.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/demo.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`
- Test: `src/server/authRules.test.ts`

**Interfaces:**
- Consumes: `db()` (Task 6), schema tables `office_members`, `offices`.
- Produces:
  - `safeNext(next:string|null|undefined):string` (returns `next` only if it is a same-site path, else `/board`)
  - `assertSameOffice(rowOfficeId:string|null|undefined, officeId:string):void` (throws `Error('forbidden')`)
  - `requireOffice():Promise<{userId:string; officeId:string}>` (redirects to `/login` when there is no session or no membership)
  - `supabaseServer()`, `supabaseBrowser()` (cookie-aware clients from `@supabase/ssr`)
  - `DEMO = {email:string; password:string}`
  - Server actions `signIn(form)`, `signUp(form)`, `signOut()`

- [ ] **Step 1: Install**

```bash
npm i @supabase/ssr
```

- [ ] **Step 2: Write the failing test `src/server/authRules.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { assertSameOffice, safeNext } from './authRules';

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/board/abc?x=1')).toBe('/board/abc?x=1');
  });
  it('blocks open redirects', () => {
    expect(safeNext('https://evil.com')).toBe('/board');
    expect(safeNext('//evil.com')).toBe('/board');
    expect(safeNext('/\\evil.com')).toBe('/board');
    expect(safeNext('javascript:alert(1)')).toBe('/board');
  });
  it('defaults when missing', () => {
    expect(safeNext(null)).toBe('/board');
    expect(safeNext(undefined)).toBe('/board');
    expect(safeNext('')).toBe('/board');
  });
});

describe('assertSameOffice', () => {
  it('passes for the same office', () => expect(() => assertSameOffice('o1', 'o1')).not.toThrow());
  it('throws for another office, missing row, or missing office', () => {
    expect(() => assertSameOffice('o2', 'o1')).toThrow('forbidden');
    expect(() => assertSameOffice(null, 'o1')).toThrow('forbidden');
    expect(() => assertSameOffice(undefined, 'o1')).toThrow('forbidden');
  });
});
```

- [ ] **Step 3: Run to verify failure**, `npx vitest run src/server/authRules.test.ts`. Expected FAIL.

- [ ] **Step 4: Create `src/server/authRules.ts` (pure, no Next imports)**

```ts
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/board';
  return next;
}

export function assertSameOffice(rowOfficeId: string | null | undefined, officeId: string): void {
  if (!rowOfficeId || rowOfficeId !== officeId) throw new Error('forbidden');
}
```

- [ ] **Step 5: Run to verify pass**, `npx vitest run src/server/authRules.test.ts`. Expected PASS.

- [ ] **Step 6: Create the Supabase clients**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a Server Component: middleware refreshes the session */ }
      },
    },
  });
}
```
`src/lib/supabase/browser.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';

export const supabaseBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```

- [ ] **Step 7: Create `src/server/auth.ts`**

```ts
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { db } from './db';

export { assertSameOffice, safeNext } from './authRules';

export async function requireOffice(): Promise<{ userId: string; officeId: string }> {
  const {
    data: { user },
  } = await (await supabaseServer()).auth.getUser();
  if (!user) redirect('/login');
  const { data } = await db().from('office_members').select('office_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (!data) redirect('/login?error=nooffice');
  return { userId: user.id, officeId: data.office_id as string };
}
```

- [ ] **Step 8: Create `src/middleware.ts` (session refresh and route protection)**

In Next.js 16 and later this file is named `src/proxy.ts` and the exported function is `proxy`. Check the installed version with `npx next --version` and use the matching name.

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = [/^\/login/, /^\/c\//, /^\/api\/upload/, /^\/api\/jobs\/sweep/];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user && !PUBLIC.some((r) => r.test(req.nextUrl.pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)'] };
```

- [ ] **Step 9: Create `src/lib/demo.ts` and `src/app/login/actions.ts`**

`src/lib/demo.ts`:
```ts
// Public on purpose: the demo office holds invented data only.
export const DEMO = { email: 'ahmed@demo.qaid.app', password: 'qaid-demo-2026' };
```
`src/app/login/actions.ts`:
```ts
'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { db } from '@/server/db';
import { safeNext } from '@/server/authRules';

export async function signIn(form: FormData) {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) });
  if (error) redirect('/login?error=1');
  redirect(safeNext(String(form.get('next') ?? '')));
}

export async function signUp(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || password.length < 8) redirect('/login?error=2');
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error || !data.user) redirect('/login?error=2');
  const { data: office } = await db().from('offices').insert({ name: email }).select('id').single();
  await db().from('office_members').insert({ user_id: data.user.id, office_id: office!.id });
  if (!data.session) redirect('/login?check=1'); // email confirmation is on
  redirect('/board');
}

export async function signOut() {
  await (await supabaseServer()).auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 10: Create `src/app/login/page.tsx`**

```tsx
import { DEMO } from '@/lib/demo';
import { signIn, signUp } from './actions';

const MSG: Record<string, string> = { '1': 'البريد أو كلمة المرور غير صحيحة', '2': 'تعذّر إنشاء الحساب (كلمة المرور 8 أحرف على الأقل)', nooffice: 'هذا الحساب غير مرتبط بمكتب' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; check?: string }> }) {
  const sp = await searchParams;
  const input = 'w-full rounded-xl border border-neutral-200 px-4 py-3';
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">قيد</h1>
      {sp.error && <p className="text-red-600">{MSG[sp.error] ?? '!'}</p>}
      {sp.check && <p className="text-emerald-700">تحقق من بريدك لتأكيد الحساب</p>}

      <form action={signIn} className="space-y-3">
        <input type="hidden" name="next" value={sp.next ?? ''} />
        <input name="email" type="email" required placeholder="البريد الإلكتروني" className={input} dir="ltr" />
        <input name="password" type="password" required placeholder="كلمة المرور" className={input} dir="ltr" />
        <button className="w-full rounded-full bg-[var(--accent)] py-3 text-white">دخول</button>
      </form>

      <form action={signIn} className="rounded-2xl bg-neutral-50 p-4">
        <input type="hidden" name="next" value={sp.next ?? ''} />
        <input type="hidden" name="email" value={DEMO.email} />
        <input type="hidden" name="password" value={DEMO.password} />
        <p className="mb-2 text-sm text-neutral-500">حساب تجريبي: أحمد، مكتب محاسبة (بيانات مخترعة)</p>
        <button className="w-full rounded-full border border-[var(--accent)] py-3 text-[var(--accent)]">ادخل كأحمد</button>
      </form>

      <details className="text-sm text-neutral-500">
        <summary className="cursor-pointer">إنشاء حساب جديد</summary>
        <form action={signUp} className="mt-3 space-y-3">
          <input name="email" type="email" required placeholder="البريد الإلكتروني" className={input} dir="ltr" />
          <input name="password" type="password" required minLength={8} placeholder="كلمة المرور (8 أحرف على الأقل)" className={input} dir="ltr" />
          <button className="w-full rounded-full border py-3">إنشاء</button>
        </form>
      </details>
    </main>
  );
}
```

- [ ] **Step 11: Verify**

Run `npm run dev` (the demo user is created by the seed in Task 14; for now sign up a test user through the form).
Expected: opening `/board` while signed out redirects to `/login?next=/board`; `/c/<token>` and `POST /api/upload` stay open without login; after sign-up you land on `/board` (empty; Task 12 adds the add-client form). `/login?next=https://evil.com` signs in then lands on `/board`, not on evil.com. Sign out clears the session.

- [ ] **Step 12: Commit**

```bash
git add src package.json package-lock.json && git commit -m "feat: Supabase Auth for accountants with office membership and demo login" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Foundry clients (GPT-6, Parse v5) and the two extraction lanes

**Files:**
- Create: `src/server/ai.ts`, `src/server/parse.ts`, `src/server/extractReceipt.ts`, `src/server/categorise.ts`, `scripts/smoke-ai.ts`
- Test: `src/server/extractReceipt.test.ts`

**Interfaces:**
- Consumes: `fuse`, `Fused` (Task 3); `Extracted`; `Llm`, `Msg` (Task 5); `env` (Task 6).
- Produces:
  - `openai(): AzureOpenAI`
  - `gptLlm(): Llm` (adapts chat completions with tool calling to the `Llm` interface)
  - `structureReceipt(input:{text?:string; imageDataUrl?:string}): Promise<Extracted>`
  - `parseToMarkdown(imageBase64:string, mime:string): Promise<string>`
  - `extractReceipt(imageBase64:string, mime:string, deps?:Lanes): Promise<Fused>` where `Lanes = {laneA:(b64:string,mime:string)=>Promise<{fields:Extracted; markdown:string}>; laneB:(b64:string,mime:string)=>Promise<{fields:Extracted}>}`
  - `categorise(i:{vendor:string; docType:DocType; total:number}): Promise<{category:Category; confidence:number; question:string|null}>`
  - `chatText(messages:Msg[]): Promise<string>`

- [ ] **Step 1: Write the failing test for lane orchestration `src/server/extractReceipt.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { extractReceipt } from './extractReceipt';
import type { Extracted } from '@/brain/types';

const ok: Extracted = { vendor: 'Spinneys', date: '2026-10-05', subtotal: 100, vat: 14, total: 114, docType: 'purchase' };

describe('extractReceipt', () => {
  it('fuses both lanes', async () => {
    const r = await extractReceipt('b64', 'image/jpeg', {
      laneA: async () => ({ fields: ok, markdown: 'Spinneys 114.00' }),
      laneB: async () => ({ fields: ok }),
    });
    expect(r.confidence).toBe('high');
  });

  it('survives one lane failing', async () => {
    const r = await extractReceipt('b64', 'image/jpeg', {
      laneA: async () => { throw new Error('parse down'); },
      laneB: async () => ({ fields: ok }),
    });
    expect(r.fields.total.value).toBe(114);
    expect(r.confidence).toBe('medium');
  });

  it('throws when both lanes fail so the job retries', async () => {
    await expect(
      extractReceipt('b64', 'image/jpeg', {
        laneA: async () => { throw new Error('a'); },
        laneB: async () => { throw new Error('b'); },
      }),
    ).rejects.toThrow('both lanes failed');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/server`
Expected: FAIL, module not found.

- [ ] **Step 3: Create `src/server/ai.ts`**

```ts
import { AzureOpenAI } from 'openai';
import { z } from 'zod';
import type { Llm, Msg } from '@/brain/ask/loop';
import type { Extracted } from '@/brain/types';
import { env } from './env';

let client: AzureOpenAI | null = null;
export const openai = () =>
  (client ??= new AzureOpenAI({ endpoint: env.aoaiEndpoint, apiKey: env.aoaiKey, apiVersion: env.aoaiVersion, deployment: env.deployment }));

const toOpenAi = (messages: Msg[]) =>
  messages.map((m) => {
    if (m.role === 'tool') return { role: 'tool' as const, tool_call_id: m.toolCallId!, content: m.content ?? '' };
    if (m.role === 'assistant' && m.toolCalls?.length)
      return {
        role: 'assistant' as const,
        content: m.content,
        tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: JSON.stringify(c.args) } })),
      };
    return { role: m.role as 'system' | 'user' | 'assistant', content: m.content ?? '' };
  });

export const gptLlm = (): Llm => ({
  async chat(messages, tools) {
    const r = await openai().chat.completions.create({
      model: env.deployment,
      messages: toOpenAi(messages),
      ...(tools.length
        ? { tools: tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters as Record<string, unknown> } })) }
        : {}),
    });
    const msg = r.choices[0].message;
    return {
      content: msg.content,
      toolCalls: (msg.tool_calls ?? []).flatMap((c) =>
        c.type === 'function' ? [{ id: c.id, name: c.function.name, args: JSON.parse(c.function.arguments || '{}') }] : [],
      ),
    };
  },
});

export async function chatText(messages: Msg[]): Promise<string> {
  const r = await gptLlm().chat(messages, []);
  return r.content ?? '';
}

const ExtractedSchema = z.object({
  vendor: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  subtotal: z.number().nullable(),
  vat: z.number().nullable(),
  total: z.number().nullable(),
  docType: z.enum(['purchase', 'sale', 'payment_screenshot', 'other']),
});

const num = { type: ['number', 'null'] };
const RECEIPT_JSON_SCHEMA = {
  name: 'receipt',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['vendor', 'date', 'subtotal', 'vat', 'total', 'docType'],
    properties: {
      vendor: { type: ['string', 'null'] },
      date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      subtotal: num,
      vat: num,
      total: num,
      docType: { type: 'string', enum: ['purchase', 'sale', 'payment_screenshot', 'other'] },
    },
  },
} as const;

const SYSTEM = `You read Egyptian receipts, supplier invoices and payment screenshots (Arabic or English, printed).
Return the fields as JSON. Rules: amounts are plain numbers in EGP (convert Arabic-Indic digits to ASCII digits).
Dates as YYYY-MM-DD. Use null for anything not printed. NEVER compute or infer a missing amount. NEVER invent a vendor.
docType: purchase = receipt for something the shop bought; sale = receipt the shop issued to a customer; payment_screenshot; other.`;

export async function structureReceipt(input: { text?: string; imageDataUrl?: string }): Promise<Extracted> {
  const content = input.imageDataUrl
    ? [{ type: 'text' as const, text: 'Read this receipt.' }, { type: 'image_url' as const, image_url: { url: input.imageDataUrl } }]
    : `Receipt text (Markdown from an OCR parser):\n${input.text}`;
  const r = await openai().chat.completions.create({
    model: env.deployment,
    reasoning_effort: 'low',
    response_format: { type: 'json_schema', json_schema: RECEIPT_JSON_SCHEMA },
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
  });
  return ExtractedSchema.parse(JSON.parse(r.choices[0].message.content ?? '{}'));
}
```
If the installed `openai` types reject `reasoning_effort` for the deployed API version, cast the params object `as never` and keep the field; do not drop low effort.

- [ ] **Step 4: Create `src/server/parse.ts` (Cohere Parse v5)**

First, record the exact request shape. Open https://docs.cohere.com/docs/cohere-on-microsoft-azure and the model card for `Cohere-parse-v5` in the Foundry portal (Models + endpoints, "Consume" tab). Save the documented URL path, auth header, and request/response JSON in `docs/notes/parse-api.md`.

Then implement exactly that shape. Only the body of `callParse` depends on it; everything else is stable:

```ts
import { env } from './env';

/** Returns Markdown for one image. Request/response shape per docs/notes/parse-api.md. */
export async function parseToMarkdown(imageBase64: string, mime: string): Promise<string> {
  const res = await callParse(`data:${mime};base64,${imageBase64}`);
  if (!res.trim()) throw new Error('parse returned empty markdown');
  return res;
}

async function callParse(imageDataUrl: string): Promise<string> {
  const r = await fetch(env.parseEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.parseKey}` },
    body: JSON.stringify({ model: env.parseModel, image: imageDataUrl }), // adjust to docs/notes/parse-api.md
  });
  if (!r.ok) throw new Error(`parse ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return String(j.markdown ?? j.text ?? j.output ?? ''); // adjust to docs/notes/parse-api.md
}
```

- [ ] **Step 5: Create `src/server/extractReceipt.ts`**

```ts
import { fuse, type Fused } from '@/brain/extract/fuse';
import type { Extracted } from '@/brain/types';
import { env } from './env';
import { structureReceipt } from './ai';
import { parseToMarkdown } from './parse';

export interface Lanes {
  laneA: (b64: string, mime: string) => Promise<{ fields: Extracted; markdown: string }>;
  laneB: (b64: string, mime: string) => Promise<{ fields: Extracted }>;
}

const defaultLanes: Lanes = {
  async laneA(b64, mime) {
    const markdown = await parseToMarkdown(b64, mime);
    return { fields: await structureReceipt({ text: markdown }), markdown };
  },
  async laneB(b64, mime) {
    return { fields: await structureReceipt({ imageDataUrl: `data:${mime};base64,${b64}` }) };
  },
};

export async function extractReceipt(b64: string, mime: string, lanes: Lanes = defaultLanes): Promise<Fused> {
  const useB = lanes !== defaultLanes || env.fusion;
  const [a, b] = await Promise.allSettled([lanes.laneA(b64, mime), useB ? lanes.laneB(b64, mime) : Promise.reject(new Error('fusion off'))]);
  return fuse(a.status === 'fulfilled' ? a.value.fields : null, b.status === 'fulfilled' ? b.value.fields : null, a.status === 'fulfilled' ? a.value.markdown : null);
}
```

- [ ] **Step 6: Create `src/server/categorise.ts`**

```ts
import { z } from 'zod';
import { CATEGORIES, type Category } from '@/brain/config';
import type { DocType } from '@/brain/types';
import { openai } from './ai';
import { env } from './env';

const Out = z.object({ category: z.enum(CATEGORIES), confidence: z.number().min(0).max(1), question: z.string().nullable() });

export async function categorise(i: { vendor: string; docType: DocType; total: number }) {
  if (i.docType === 'sale') return { category: 'sales' as Category, confidence: 1, question: null };
  const r = await openai().chat.completions.create({
    model: env.deployment,
    reasoning_effort: 'low',
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'cat', strict: true,
        schema: {
          type: 'object', additionalProperties: false, required: ['category', 'confidence', 'question'],
          properties: {
            category: { type: 'string', enum: [...CATEGORIES] },
            confidence: { type: 'number' },
            question: { type: ['string', 'null'], description: 'One short Arabic question for the accountant if confidence is below 0.7, else null' },
          },
        },
      },
    },
    messages: [
      { role: 'system', content: 'Classify an expense of a small Egyptian business into exactly one category. If unsure, lower confidence and ask one short Arabic question.' },
      { role: 'user', content: `Vendor: ${i.vendor}\nDocument type: ${i.docType}\nTotal EGP: ${i.total}` },
    ],
  });
  return Out.parse(JSON.parse(r.choices[0].message.content ?? '{}'));
}
```

- [ ] **Step 7: Run unit test, then live smoke**

Run: `npx vitest run src/server`
Expected: 3 passed.

Create `scripts/smoke-ai.ts`:
```ts
import { readFileSync } from 'node:fs';
import { extractReceipt } from '../src/server/extractReceipt';

const path = process.argv[2];
if (!path) throw new Error('usage: npm run smoke:ai -- path/to/receipt.jpg');
const b64 = readFileSync(path).toString('base64');
extractReceipt(b64, 'image/jpeg').then((r) => console.log(JSON.stringify(r, null, 2)));
```
Run with real keys and one sample photo: `npm run smoke:ai -- samples/photos/01.jpg`
Expected: JSON with `fields`, `confidence`. If `parse` throws, fix `callParse` against `docs/notes/parse-api.md`; lane B should still succeed alone with `confidence: "medium"`.

- [ ] **Step 8: Commit**

```bash
git add src scripts docs/notes && git commit -m "feat(server): GPT-6 and Parse v5 clients, two-lane extraction, categorise" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Jobs queue (store, runner, retry)

**Files:**
- Create: `src/server/jobs.ts`, `src/server/jobStore.ts`
- Test: `src/server/jobs.test.ts`

**Interfaces:**
- Produces:
  - `interface Job { id:string; type:string; payload:Record<string,unknown>; attempts:number }`
  - `interface JobStore { claim():Promise<Job|null>; complete(id:string):Promise<void>; fail(id:string, error:string, retryAt:Date|null):Promise<void> }` (`retryAt === null` means dead)
  - `type Handlers = Record<string,(payload:Record<string,unknown>)=>Promise<void>>`
  - `runNext(store, handlers, opts?:{maxAttempts?:number; onDead?:(job:Job, error:string)=>Promise<void>}): Promise<boolean>`
  - `drain(store, handlers, opts?:{limit?:number} & the above): Promise<number>`
  - `enqueue(type:string, payload:Record<string,unknown>): Promise<void>`
  - `supabaseJobStore(): JobStore`

- [ ] **Step 1: Write the failing test `src/server/jobs.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { drain, runNext, type Job, type JobStore } from './jobs';

function memStore(jobs: Job[]) {
  const log: string[] = [];
  const store: JobStore = {
    async claim() { const j = jobs.shift() ?? null; if (j) j.attempts += 1; return j; },
    async complete(id) { log.push(`done:${id}`); },
    async fail(id, _e, retryAt) { log.push(retryAt ? `retry:${id}` : `dead:${id}`); },
  };
  return { store, log };
}
const job = (id: string, attempts = 0): Job => ({ id, type: 't', payload: {}, attempts });

describe('runNext', () => {
  it('completes a successful job', async () => {
    const { store, log } = memStore([job('a')]);
    expect(await runNext(store, { t: async () => {} })).toBe(true);
    expect(log).toEqual(['done:a']);
  });
  it('returns false when queue empty', async () => {
    expect(await runNext(memStore([]).store, {})).toBe(false);
  });
  it('schedules a retry on failure before max attempts', async () => {
    const { store, log } = memStore([job('a')]);
    await runNext(store, { t: async () => { throw new Error('x'); } });
    expect(log).toEqual(['retry:a']);
  });
  it('goes dead after max attempts and calls onDead', async () => {
    const { store, log } = memStore([job('a', 2)]); // claim bumps to 3
    const dead: string[] = [];
    await runNext(store, { t: async () => { throw new Error('boom'); } }, { maxAttempts: 3, onDead: async (j, e) => { dead.push(`${j.id}:${e}`); } });
    expect(log).toEqual(['dead:a']);
    expect(dead[0]).toContain('boom');
  });
  it('unknown job type counts as failure', async () => {
    const { store, log } = memStore([job('a', 2)]);
    await runNext(store, {}, { maxAttempts: 3 });
    expect(log).toEqual(['dead:a']);
  });
});

describe('drain', () => {
  it('runs until empty or limit', async () => {
    const { store } = memStore([job('a'), job('b'), job('c')]);
    expect(await drain(store, { t: async () => {} }, { limit: 2 })).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/server/jobs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/jobs.ts`**

```ts
export interface Job { id: string; type: string; payload: Record<string, unknown>; attempts: number }
export interface JobStore {
  claim(): Promise<Job | null>;
  complete(id: string): Promise<void>;
  fail(id: string, error: string, retryAt: Date | null): Promise<void>;
}
export type Handlers = Record<string, (payload: Record<string, unknown>) => Promise<void>>;
interface Opts { maxAttempts?: number; onDead?: (job: Job, error: string) => Promise<void> }

export async function runNext(store: JobStore, handlers: Handlers, opts: Opts = {}): Promise<boolean> {
  const max = opts.maxAttempts ?? 3;
  const job = await store.claim();
  if (!job) return false;
  try {
    const h = handlers[job.type];
    if (!h) throw new Error(`no handler for ${job.type}`);
    await h(job.payload);
    await store.complete(job.id);
  } catch (err) {
    const msg = String(err);
    if (job.attempts >= max) {
      await store.fail(job.id, msg, null);
      await opts.onDead?.(job, msg);
    } else {
      await store.fail(job.id, msg, new Date(Date.now() + 5000 * job.attempts));
    }
  }
  return true;
}

export async function drain(store: JobStore, handlers: Handlers, opts: Opts & { limit?: number } = {}): Promise<number> {
  let n = 0;
  while (n < (opts.limit ?? 10) && (await runNext(store, handlers, opts))) n++;
  return n;
}
```

- [ ] **Step 4: Implement `src/server/jobStore.ts`**

```ts
import { db } from './db';
import type { Job, JobStore } from './jobs';

export async function enqueue(type: string, payload: Record<string, unknown>) {
  const { error } = await db().from('jobs').insert({ type, payload });
  if (error) throw error;
}

export const supabaseJobStore = (): JobStore => ({
  async claim() {
    const { data, error } = await db().rpc('claim_job');
    if (error) throw error;
    return data?.id ? ({ id: data.id, type: data.type, payload: data.payload, attempts: data.attempts } as Job) : null;
  },
  async complete(id) {
    await db().from('jobs').update({ status: 'done' }).eq('id', id);
  },
  async fail(id, error, retryAt) {
    await db().from('jobs').update(retryAt ? { status: 'retry', error, run_at: retryAt.toISOString() } : { status: 'dead', error }).eq('id', id);
  },
});
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/server/jobs.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/server && git commit -m "feat(server): Postgres-backed job queue with retry and dead state" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Upload API and client phone page (priority 1)

**Files:**
- Create: `src/app/api/upload/route.ts`, `src/app/c/[token]/page.tsx`, `src/app/c/[token]/Uploader.tsx`, `src/i18n/dict.ts`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `db()`, `enqueue`, `drain`, `supabaseJobStore`, `handlers` from Task 10 (`src/server/processDocument.ts` exports `handlers` and `onDead`; until Task 10 exists, create the file exporting `export const handlers = {}; export const onDead = async () => {};` and replace it in Task 10).
- Produces: `POST /api/upload?token=<token>` multipart field `file` (repeatable); response `{ok:true, count:number}`; each file becomes one `documents` row with `status='received'`, sha256 `image_hash`, and one `process_document` job.

- [ ] **Step 1: Create `src/i18n/dict.ts`**

```ts
export type Lang = 'ar' | 'en';
export const dict = {
  ar: {
    send: 'صوّر الإيصال',
    gotIt: 'تم الاستلام. شكراً',
    another: 'أضف إيصالاً آخر',
    sending: 'جارٍ الإرسال…',
    retake: 'الصورة غير واضحة. صوّر مرة أخرى',
    board: 'لوحة العملاء',
    invented: 'بيانات تجريبية مخترعة',
  },
  en: {
    send: 'Photograph receipt',
    gotIt: 'Got it. Thank you',
    another: 'Add another receipt',
    sending: 'Sending…',
    retake: 'Photo is unclear. Please retake',
    board: 'Client board',
    invented: 'Invented demo data',
  },
} as const;
export const t = (lang: Lang, k: keyof (typeof dict)['ar']) => dict[lang][k];
```

- [ ] **Step 2: Create `src/app/api/upload/route.ts`**

```ts
import { createHash, randomUUID } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { drain } from '@/server/jobs';
import { enqueue, supabaseJobStore } from '@/server/jobStore';
import { handlers, onDead } from '@/server/processDocument';

export const maxDuration = 60;
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  const { data: client } = await db().from('clients').select('id').eq('token', token ?? '').maybeSingle();
  if (!client) return NextResponse.json({ error: 'unknown link' }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'no file' }, { status: 400 });
  const batchId = files.length > 1 ? randomUUID() : null;

  for (const f of files) {
    if (!f.type.startsWith('image/') || f.size > MAX_BYTES) return NextResponse.json({ error: 'bad file' }, { status: 400 });
    const bytes = Buffer.from(await f.arrayBuffer());
    const path = `${client.id}/${randomUUID()}.jpg`;
    const up = await db().storage.from('receipts').upload(path, bytes, { contentType: f.type });
    if (up.error) return NextResponse.json({ error: 'storage' }, { status: 500 });
    const { data: doc, error } = await db()
      .from('documents')
      .insert({ client_id: client.id, image_path: path, image_hash: createHash('sha256').update(bytes).digest('hex'), batch_id: batchId })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: 'db' }, { status: 500 });
    await enqueue('process_document', { documentId: doc.id });
  }

  after(() => drain(supabaseJobStore(), handlers, { limit: 5, onDead }));
  return NextResponse.json({ ok: true, count: files.length });
}
```

- [ ] **Step 3: Create `src/app/c/[token]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { t, type Lang } from '@/i18n/dict';
import { Uploader } from './Uploader';

export default async function ClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: client } = await db().from('clients').select('name').eq('token', token).maybeSingle();
  if (!client) notFound();
  const lang = ((await cookies()).get('lang')?.value ?? 'ar') as Lang;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-semibold">{client.name}</h1>
      <Uploader token={token} labels={{ send: t(lang, 'send'), gotIt: t(lang, 'gotIt'), another: t(lang, 'another'), sending: t(lang, 'sending') }} />
      <p className="text-xs text-neutral-400">{t(lang, 'invented')}</p>
    </main>
  );
}
```

- [ ] **Step 4: Create `src/app/c/[token]/Uploader.tsx` (downscale, upload, got-it)**

```tsx
'use client';
import { useRef, useState } from 'react';

async function downscale(file: File, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.85));
}

export function Uploader({ token, labels }: { token: string; labels: Record<'send' | 'gotIt' | 'another' | 'sending', string> }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setState('sending');
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append('file', await downscale(f), 'receipt.jpg');
      const r = await fetch(`/api/upload?token=${token}`, { method: 'POST', body: form });
      setState(r.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
    if (input.current) input.current.value = '';
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPick(e.target.files)} />
      <button
        onClick={() => input.current?.click()}
        disabled={state === 'sending'}
        className="h-40 w-full rounded-3xl bg-[var(--accent)] text-2xl font-medium text-white active:scale-[0.98] disabled:opacity-60"
      >
        {state === 'sending' ? labels.sending : state === 'done' ? labels.another : labels.send}
      </button>
      {state === 'done' && <p className="text-lg text-[var(--accent)]">{labels.gotIt}</p>}
      {state === 'error' && <p className="text-red-600">!</p>}
    </div>
  );
}
```

- [ ] **Step 5: Layout: RTL, Arabic default, accent token**

Replace `src/app/layout.tsx` body of the root with:
```tsx
import './globals.css';
import { cookies } from 'next/headers';

export const metadata = { title: 'Qaid قيد' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = (await cookies()).get('lang')?.value === 'en' ? 'en' : 'ar';
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
```
In `src/app/globals.css` keep the Tailwind import and add: `:root { --accent: #0f766e; }`.

- [ ] **Step 6: Create the placeholder `src/server/processDocument.ts`**

```ts
export const handlers = {};
export const onDead = async () => {};
```

- [ ] **Step 7: Verify end to end (priority 1)**

Seed one client manually in the Supabase table editor (office row, client row, copy its `token`). Run `npm run dev`. On a phone on the same network (or devtools device mode) open `http://<host>:3000/c/<token>`, take a photo.
Expected: "got it" appears fast; a `documents` row with `status=received` and a `jobs` row exist; the image is in the `receipts` bucket. Invalid token path returns 404; uploading a non-image returns 400 (check with `curl -F file=@package.json "localhost:3000/api/upload?token=<token>"`).

- [ ] **Step 8: Commit**

```bash
git add src && git commit -m "feat: client phone page and upload API" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Process-document pipeline (priority 2)

**Files:**
- Modify: `src/server/processDocument.ts` (replace placeholder)
- Test: `src/server/processDocument.test.ts`

**Interfaces:**
- Consumes: `extractReceipt` (Task 7), `categorise` (Task 7), `findDuplicates`, `findPriceJump`, `findVatSpike` (Task 4), `db()`.
- Produces:
  - `processDocument(documentId:string, deps?:Deps): Promise<void>` where `Deps = {extract:(b64:string,mime:string)=>Promise<Fused>; categorise: typeof categorise; repo: Repo}`
  - `interface Repo { setStatus(id:string, s:string, error?:string):Promise<void>; loadImage(docId:string):Promise<{b64:string; mime:string; clientId:string; imageHash:string|null}>; entriesForClient(clientId:string):Promise<Entry[]>; insertEntry(e:{...}):Promise<string>; insertFlags(clientId:string, flags:Flag[]):Promise<void> }`
  - `handlers: Handlers` with `process_document`; `onDead(job, error)` sets the document `failed`.

- [ ] **Step 1: Write the failing test `src/server/processDocument.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { processDocument, type Repo } from './processDocument';
import { fuse } from '@/brain/extract/fuse';
import type { Entry, Flag } from '@/brain/types';

const ext = { vendor: 'Gulf Supplies', date: '2026-10-05', subtotal: 109, vat: 15.26, total: 124.26, docType: 'purchase' as const };

function fakeRepo(existing: Entry[] = []) {
  const state = { status: [] as string[], inserted: [] as any[], flags: [] as Flag[] };
  const repo: Repo = {
    async setStatus(_id, s) { state.status.push(s); },
    async loadImage() { return { b64: 'x', mime: 'image/jpeg', clientId: 'c1', imageHash: 'h1' }; },
    async entriesForClient() { return existing; },
    async insertEntry(e) { state.inserted.push(e); return 'new-entry'; },
    async insertFlags(_c, f) { state.flags.push(...f); },
  };
  return { repo, state };
}
const deps = (repo: Repo) => ({
  repo,
  extract: async () => fuse(ext, ext, null),
  categorise: async () => ({ category: 'supplies' as const, confidence: 0.9, question: null }),
});

describe('processDocument', () => {
  it('writes an entry and ends needs_review', async () => {
    const { repo, state } = fakeRepo();
    await processDocument('d1', deps(repo));
    expect(state.status).toEqual(['extracting', 'needs_review']);
    expect(state.inserted[0]).toMatchObject({ vendor: 'Gulf Supplies', total: 124.26, category: 'supplies' });
  });

  it('raises a price-jump flag against history', async () => {
    const hist: Entry[] = [1, 2].map((i) => ({ id: `h${i}`, clientId: 'c1', documentId: null, vendor: 'Gulf Supplies', date: `2026-0${7 + i}-05`, subtotal: 100, vat: 14, total: 114, category: 'supplies', confirmed: true }));
    const { repo, state } = fakeRepo(hist);
    await processDocument('d1', deps(repo));
    expect(state.flags.map((f) => f.kind)).toContain('price_jump');
  });

  it('raises a duplicate flag for the same image hash', async () => {
    const dup: Entry = { id: 'old', clientId: 'c1', documentId: 'd0', vendor: 'Other', date: '2026-01-01', subtotal: 1, vat: 0, total: 1, category: 'other', confirmed: true, imageHash: 'h1' };
    const { repo, state } = fakeRepo([dup]);
    await processDocument('d1', deps(repo));
    expect(state.flags.map((f) => f.kind)).toContain('duplicate');
  });

  it('first-ever vendor: no flags and no crash', async () => {
    const { repo, state } = fakeRepo([]);
    await processDocument('d1', deps(repo));
    expect(state.flags).toEqual([]);
  });

  it('extraction failure rethrows so the job retries', async () => {
    const { repo } = fakeRepo();
    await expect(processDocument('d1', { ...deps(repo), extract: async () => { throw new Error('both lanes failed'); } })).rejects.toThrow('both lanes failed');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/server/processDocument.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/processDocument.ts`**

```ts
import { findDuplicates, findPriceJump, findVatSpike } from '@/brain/checks';
import type { Fused } from '@/brain/extract/fuse';
import type { Category } from '@/brain/config';
import type { Entry, Flag } from '@/brain/types';
import { categorise as defaultCategorise } from './categorise';
import { db } from './db';
import { extractReceipt } from './extractReceipt';
import type { Handlers, Job } from './jobs';

export interface Repo {
  setStatus(id: string, status: string, error?: string): Promise<void>;
  loadImage(docId: string): Promise<{ b64: string; mime: string; clientId: string; imageHash: string | null }>;
  entriesForClient(clientId: string): Promise<Entry[]>;
  insertEntry(e: {
    clientId: string; documentId: string; vendor: string; date: string; subtotal: number; vat: number; total: number;
    category: Category; categoryConfidence: number; question: string | null; agreement: Record<string, string>; confidence: string;
  }): Promise<string>;
  insertFlags(clientId: string, flags: Flag[]): Promise<void>;
}
interface Deps {
  repo: Repo;
  extract: (b64: string, mime: string) => Promise<Fused>;
  categorise: typeof defaultCategorise;
}

export const supabaseRepo: Repo = {
  async setStatus(id, status, error) {
    await db().from('documents').update({ status, error: error ?? null }).eq('id', id);
  },
  async loadImage(docId) {
    const { data: doc } = await db().from('documents').select('client_id,image_path,image_hash').eq('id', docId).single();
    const file = await db().storage.from('receipts').download(doc!.image_path);
    if (file.error) throw file.error;
    return { b64: Buffer.from(await file.data.arrayBuffer()).toString('base64'), mime: file.data.type || 'image/jpeg', clientId: doc!.client_id, imageHash: doc!.image_hash };
  },
  async entriesForClient(clientId) {
    const { data } = await db().from('entries').select('*, documents(image_hash)').eq('client_id', clientId);
    return (data ?? []).map((r) => ({
      id: r.id, clientId: r.client_id, documentId: r.document_id, vendor: r.vendor, date: r.entry_date,
      subtotal: Number(r.subtotal), vat: Number(r.vat), total: Number(r.total), category: r.category, confirmed: r.confirmed,
      imageHash: r.documents?.image_hash ?? null,
    }));
  },
  async insertEntry(e) {
    const { data, error } = await db().from('entries').insert({
      client_id: e.clientId, document_id: e.documentId, vendor: e.vendor, entry_date: e.date, subtotal: e.subtotal, vat: e.vat, total: e.total,
      category: e.category, category_confidence: e.categoryConfidence, question: e.question, agreement: e.agreement, confidence: e.confidence,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  },
  async insertFlags(clientId, flags) {
    if (!flags.length) return;
    await db().from('flags').insert(flags.map((f) => ({ client_id: clientId, entry_id: f.entryId, kind: f.kind, detail: f.detail })));
  },
};

const month = (d: string) => d.slice(0, 7);

export async function processDocument(documentId: string, deps: Deps = { repo: supabaseRepo, extract: extractReceipt, categorise: defaultCategorise }) {
  const { repo } = deps;
  await repo.setStatus(documentId, 'extracting');
  const img = await repo.loadImage(documentId);
  const fused = await deps.extract(img.b64, img.mime); // throws if both lanes fail: job retries

  const f = fused.fields;
  const vendor = String(f.vendor.value ?? '');
  const date = String(f.date.value ?? new Date().toISOString().slice(0, 10));
  const subtotal = Number(f.subtotal.value ?? f.total.value ?? 0);
  const vat = Number(f.vat.value ?? 0);
  const total = Number(f.total.value ?? 0);
  const cat = await deps.categorise({ vendor, docType: fused.docType, total });

  const entryId = await repo.insertEntry({
    clientId: img.clientId, documentId, vendor, date, subtotal, vat, total, category: cat.category, categoryConfidence: cat.confidence,
    question: cat.question, agreement: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.agreement])), confidence: fused.confidence,
  });

  const entry: Entry = { id: entryId, clientId: img.clientId, documentId, vendor, date, subtotal, vat, total, category: cat.category, confirmed: false, imageHash: img.imageHash };
  const all = await repo.entriesForClient(img.clientId);
  const others = all.filter((e) => e.id !== entryId);
  const history = others.filter((e) => e.vendor.trim().toLowerCase() === vendor.trim().toLowerCase() && e.date < date);
  const priorVats = [...new Set(others.map((e) => month(e.date)).filter((m) => m < month(date)))].map((m) =>
    others.filter((e) => month(e.date) === m).reduce((s, e) => s + e.vat, 0),
  );
  const thisMonthVat = [...others, entry].filter((e) => month(e.date) === month(date)).reduce((s, e) => s + e.vat, 0);

  const flags = [
    ...findDuplicates(entry, others),
    ...[findPriceJump(entry, history), findVatSpike(entryId, thisMonthVat, priorVats)].filter((x): x is Flag => !!x),
  ];
  await repo.insertFlags(img.clientId, flags);
  await repo.setStatus(documentId, 'needs_review');
}

export const handlers: Handlers = {
  process_document: async (p) => processDocument(String(p.documentId)),
};
export const onDead = async (job: Job, error: string) => {
  if (job.type === 'process_document') await supabaseRepo.setStatus(String(job.payload.documentId), 'failed', error);
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/server/processDocument.test.ts`
Expected: all pass.

- [ ] **Step 5: Live check (priority 2)**

With real keys, upload a photo again through the phone page.
Expected within seconds: `documents.status` goes `received` to `extracting` to `needs_review`; an `entries` row exists with plausible vendor/total; `entries.agreement` shows per-field `agree/resolved/single`. Upload the exact same photo twice: second one gets a `duplicate` flag. Break `AZURE_OPENAI_API_KEY` and `COHERE_PARSE_KEY` and upload: after retries the document ends `failed`.

- [ ] **Step 6: Commit**

```bash
git add src && git commit -m "feat(server): process-document pipeline with fusion, categorise, checks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Board, queries, live refresh (priority 4)

**Files:**
- Create: `src/server/queries.ts`, `src/app/board/page.tsx`, `src/app/board/LiveRefresh.tsx`, `src/app/page.tsx`
- Test: `src/server/queries.test.ts` (pure helper only)

**Interfaces:**
- Consumes: `clientStatus`, `isSilent`, `missingExpected` (Task 4); `db()`.
- Produces:
  - `monthKey(d:Date):string` (`YYYY-MM`), `shiftMonth(m:string, delta:number):string`
  - `loadBoard(officeId:string, now?:Date): Promise<BoardRow[]>` (only that office's clients) where `BoardRow = {id:string; name:string; token:string; status:ClientStatus; counts:{review:number; flags:number; missing:string[]; uploads:number}}`

- [ ] **Step 1: Write failing test `src/server/queries.test.ts`**

```ts
import { expect, it } from 'vitest';
import { monthKey, shiftMonth } from './queries';

it('monthKey', () => expect(monthKey(new Date('2026-10-02T10:00:00Z'))).toBe('2026-10'));
it('shiftMonth wraps years', () => {
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2026-11', 2)).toBe('2027-01');
});
```

- [ ] **Step 2: Run to verify failure**, `npx vitest run src/server/queries.test.ts`. Expected FAIL.

- [ ] **Step 3: Create `src/server/queries.ts`**

```ts
import { clientStatus, isSilent, missingExpected, type ClientStatus } from '@/brain/status';
import type { Entry } from '@/brain/types';
import { db } from './db';

export const monthKey = (d: Date) => d.toISOString().slice(0, 7);
export function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const idx = y * 12 + (mo - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export interface BoardRow {
  id: string; name: string; token: string; status: ClientStatus;
  counts: { review: number; flags: number; missing: string[]; uploads: number };
}

export const mapEntry = (r: any): Entry => ({
  id: r.id, clientId: r.client_id, documentId: r.document_id, vendor: r.vendor, date: r.entry_date,
  subtotal: Number(r.subtotal), vat: Number(r.vat), total: Number(r.total), category: r.category, confirmed: r.confirmed,
});

export async function loadBoard(officeId: string, now = new Date()): Promise<BoardRow[]> {
  const cur = monthKey(now);
  const clients = await db().from('clients').select('id,name,token').eq('office_id', officeId).order('name');
  const ids = (clients.data ?? []).map((c) => c.id);
  if (!ids.length) return [];
  const [docs, entries, flags, expected] = await Promise.all([
    db().from('documents').select('id,client_id,status,created_at').in('client_id', ids),
    db().from('entries').select('*').in('client_id', ids),
    db().from('flags').select('client_id,open').eq('open', true).in('client_id', ids),
    db().from('expected_docs').select('client_id,vendor').in('client_id', ids),
  ]);
  return (clients.data ?? []).map((c) => {
    const myDocs = (docs.data ?? []).filter((d) => d.client_id === c.id);
    const myEntries = (entries.data ?? []).filter((e) => e.client_id === c.id).map(mapEntry);
    const uploadsIn = (m: string) => myDocs.filter((d) => d.created_at.slice(0, 7) === m).length;
    // prior-month uploads also count entries (seeded history has entries without documents)
    const activityIn = (m: string) => Math.max(uploadsIn(m), myEntries.filter((e) => e.date.slice(0, 7) === m).length);
    const prior = [shiftMonth(cur, -1), shiftMonth(cur, -2)].map(activityIn);
    const uploads = activityIn(cur);
    const monthVendors = myEntries.filter((e) => e.date.slice(0, 7) === cur).map((e) => e.vendor);
    const missing = missingExpected((expected.data ?? []).filter((x) => x.client_id === c.id).map((x) => x.vendor), monthVendors);
    const review = myDocs.filter((d) => d.status === 'needs_review').length;
    const openFlags = (flags.data ?? []).filter((f) => f.client_id === c.id).length;
    const silent = isSilent(uploads, prior);
    return { id: c.id, name: c.name, token: c.token, status: clientStatus({ openFlags, missing: missing.length, silent, needsReview: review }), counts: { review, flags: openFlags, missing, uploads } };
  });
}
```

- [ ] **Step 4: Run to verify pass**, `npx vitest run src/server/queries.test.ts`. Expected PASS.

- [ ] **Step 5: Create `src/app/board/LiveRefresh.tsx`**

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const sb = supabaseBrowser(); // carries the user's JWT, so RLS limits events to their office
    const ch = sb.channel('live');
    for (const table of ['documents', 'entries', 'flags'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => router.refresh());
    ch.subscribe();
    return () => { sb.removeChannel(ch); };
  }, [router]);
  return null;
}
```

- [ ] **Step 6: Create `src/app/board/page.tsx`**

```tsx
import Link from 'next/link';
import { requireOffice } from '@/server/auth';
import { loadBoard } from '@/server/queries';
import { signOut } from '../login/actions';
import { LiveRefresh } from './LiveRefresh';

export const dynamic = 'force-dynamic';

const LABEL: Record<string, { ar: string; tone: string }> = {
  strange: { ar: 'شيء غريب', tone: 'bg-red-50 text-red-700' },
  missing: { ar: 'مستندات ناقصة', tone: 'bg-amber-50 text-amber-700' },
  silent: { ar: 'لم يرسل شيئاً', tone: 'bg-neutral-100 text-neutral-600' },
  review: { ar: 'بانتظار المراجعة', tone: 'bg-sky-50 text-sky-700' },
  ready: { ar: 'جاهز', tone: 'bg-emerald-50 text-emerald-700' },
};
const ORDER = ['strange', 'missing', 'silent', 'review', 'ready'];

export default async function Board() {
  const { officeId } = await requireOffice();
  const rows = (await loadBoard(officeId)).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  return (
    <main className="mx-auto max-w-3xl p-6">
      <LiveRefresh />
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">لوحة العملاء</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/chat" className="text-[var(--accent)]">اسأل قيد</Link>
          <span className="text-neutral-400">بيانات تجريبية مخترعة</span>
          <form action={signOut}><button className="text-neutral-500 underline">خروج</button></form>
        </div>
      </header>
      <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-100">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/board/${r.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-neutral-50">
              <span className="font-medium">{r.name}</span>
              <span className="flex items-center gap-3 text-sm text-neutral-500">
                {r.counts.review > 0 && <span>{r.counts.review} للمراجعة</span>}
                {r.counts.flags > 0 && <span>{r.counts.flags} تنبيه</span>}
                {r.counts.missing.length > 0 && <span>{r.counts.missing.length} ناقص</span>}
                <span className={`rounded-full px-3 py-1 ${LABEL[r.status].tone}`}>{LABEL[r.status].ar}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

`src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
export default function Home() { redirect('/board'); }
```

- [ ] **Step 7: Verify live**

Run `npm run dev`, open `/board` on a laptop and upload a receipt from a phone.
Expected: the client row's "للمراجعة" count appears without reloading the board.

- [ ] **Step 8: Commit**

```bash
git add src && git commit -m "feat: client board with computed statuses and live refresh" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Client detail, review table, bulk confirm (priority 3)

**Files:**
- Create: `src/server/actions.ts`, `src/app/board/[clientId]/page.tsx`, `src/app/board/[clientId]/ReviewTable.tsx`
- Test: `src/server/actions.test.ts` (pure validator)

**Interfaces:**
- Produces:
  - `canConfirm(e:{vendor:string; total:number; date:string}): boolean` (vendor non-empty, total > 0, date valid)
  - Server actions: `confirmEntries(ids:string[]):Promise<{confirmed:number; skipped:string[]}>`, `updateEntry(id:string, patch:{vendor?:string; entry_date?:string; subtotal?:number; vat?:number; total?:number; category?:string}):Promise<void>`, `retryDocument(documentId:string):Promise<void>`

- [ ] **Step 1: Write failing test `src/server/actions.test.ts`**

```ts
import { expect, it } from 'vitest';
import { canConfirm } from './actions';

it('accepts a complete entry', () => expect(canConfirm({ vendor: 'A', total: 10, date: '2026-10-01' })).toBe(true));
it('rejects empty vendor, zero total, bad date', () => {
  expect(canConfirm({ vendor: '', total: 10, date: '2026-10-01' })).toBe(false);
  expect(canConfirm({ vendor: 'A', total: 0, date: '2026-10-01' })).toBe(false);
  expect(canConfirm({ vendor: 'A', total: 10, date: 'nope' })).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure**, `npx vitest run src/server/actions.test.ts`. Expected FAIL.

- [ ] **Step 3: Create `src/server/actions.ts`**

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { enqueue, supabaseJobStore } from './jobStore';
import { drain } from './jobs';
import { handlers, onDead } from './processDocument';
import { requireOffice } from './auth';

/** Entry ids that belong to the caller's office. Browser-sent ids are never trusted. */
async function ownedEntryIds(officeId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await db().from('entries').select('id, clients!inner(office_id)').in('id', ids).eq('clients.office_id', officeId);
  return (data ?? []).map((r) => r.id as string);
}

export function canConfirm(e: { vendor: string; total: number; date: string }) {
  return e.vendor.trim() !== '' && e.total > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && !Number.isNaN(Date.parse(e.date));
}

export async function updateEntry(id: string, patch: Record<string, string | number>) {
  const allowed = ['vendor', 'entry_date', 'subtotal', 'vat', 'total', 'category'];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  const { officeId } = await requireOffice();
  if (!(await ownedEntryIds(officeId, [id])).length) return;
  await db().from('entries').update(clean).eq('id', id);
  revalidatePath('/board', 'layout');
}

export async function confirmEntries(rawIds: string[]) {
  const { officeId } = await requireOffice();
  const ids = await ownedEntryIds(officeId, rawIds);
  const { data } = await db().from('entries').select('id,vendor,total,entry_date,document_id').in('id', ids);
  const ok = (data ?? []).filter((e) => canConfirm({ vendor: e.vendor, total: Number(e.total), date: e.entry_date }));
  const skipped = ids.filter((i) => !ok.some((e) => e.id === i));
  if (ok.length) {
    await db().from('entries').update({ confirmed: true }).in('id', ok.map((e) => e.id));
    await db().from('documents').update({ status: 'confirmed' }).in('id', ok.map((e) => e.document_id).filter(Boolean));
    await db().from('flags').update({ open: false }).in('entry_id', ok.map((e) => e.id));
  }
  revalidatePath('/board', 'layout');
  return { confirmed: ok.length, skipped };
}

export async function retryDocument(documentId: string) {
  const { officeId } = await requireOffice();
  const { data: own } = await db().from('documents').select('id, clients!inner(office_id)').eq('id', documentId).eq('clients.office_id', officeId).maybeSingle();
  if (!own) return;
  await db().from('documents').update({ status: 'received', error: null }).eq('id', documentId);
  await enqueue('process_document', { documentId });
  await drain(supabaseJobStore(), handlers, { limit: 1, onDead });
  revalidatePath('/board', 'layout');
}
```
Closing a flag on confirm is the accountant's decision: confirming means "I looked at it".

- [ ] **Step 4: Run to verify pass**, `npx vitest run src/server/actions.test.ts`. Expected PASS.

- [ ] **Step 5: Create `src/app/board/[clientId]/ReviewTable.tsx`**

```tsx
'use client';
import { useState, useTransition } from 'react';
import { confirmEntries, retryDocument, updateEntry } from '@/server/actions';
import { CATEGORIES } from '@/brain/config';

export interface ReviewRow {
  id: string; documentId: string | null; vendor: string; date: string; subtotal: number; vat: number; total: number;
  category: string; question: string | null; agreement: Record<string, string>; imageUrl: string | null; flags: string[];
}

export function ReviewTable({ rows, failed }: { rows: ReviewRow[]; failed: { id: string }[] }) {
  const [picked, setPicked] = useState<string[]>(rows.map((r) => r.id));
  const [pending, start] = useTransition();
  const mark = (r: ReviewRow, f: string) => (r.agreement[f] === 'disputed' ? 'bg-amber-100 ring-1 ring-amber-300' : '');

  return (
    <section className="space-y-3">
      {failed.map((d) => (
        <div key={d.id} className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-sm text-red-700">
          تعذّرت قراءة مستند. اطلب من العميل إعادة الإرسال أو
          <button className="underline" onClick={() => start(() => retryDocument(d.id))}>أعد المحاولة</button>
        </div>
      ))}
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl border border-neutral-100 p-3 sm:grid-cols-[auto_8rem_1fr]">
          <input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))} />
          {r.imageUrl ? <a href={r.imageUrl} target="_blank"><img src={r.imageUrl} alt="" className="h-24 w-32 rounded-lg object-cover" /></a> : <span />}
          <div className="col-span-2 grid grid-cols-2 gap-2 text-sm sm:col-span-1 sm:grid-cols-3">
            <input defaultValue={r.vendor} className={`rounded border p-1 ${mark(r, 'vendor')}`} onBlur={(e) => updateEntry(r.id, { vendor: e.target.value })} />
            <input type="date" defaultValue={r.date} className={`rounded border p-1 ${mark(r, 'date')}`} onBlur={(e) => updateEntry(r.id, { entry_date: e.target.value })} />
            <select defaultValue={r.category} className="rounded border p-1" onChange={(e) => updateEntry(r.id, { category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            {(['subtotal', 'vat', 'total'] as const).map((f) => (
              <input key={f} type="number" step="0.01" defaultValue={r[f]} className={`rounded border p-1 ${mark(r, f)}`} onBlur={(e) => updateEntry(r.id, { [f]: Number(e.target.value) })} />
            ))}
            {r.question && <p className="col-span-full text-amber-700">{r.question}</p>}
            {r.flags.map((f) => <p key={f} className="col-span-full text-red-700">{f}</p>)}
          </div>
        </div>
      ))}
      {rows.length > 0 && (
        <button disabled={pending || !picked.length} onClick={() => start(async () => { await confirmEntries(picked); })} className="rounded-full bg-[var(--accent)] px-6 py-2 text-white disabled:opacity-50">
          تأكيد المحدد ({picked.length})
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Create `src/app/board/[clientId]/page.tsx`**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOffice } from '@/server/auth';
import { db } from '@/server/db';
import { monthKey } from '@/server/queries';
import { LiveRefresh } from '../LiveRefresh';
import { ReviewTable, type ReviewRow } from './ReviewTable';

export const dynamic = 'force-dynamic';

export default async function ClientDetail({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { officeId } = await requireOffice();
  const { data: client } = await db().from('clients').select('id,name,token').eq('id', clientId).eq('office_id', officeId).maybeSingle();
  if (!client) notFound(); // also the answer for another office's client id
  const [{ data: docs }, { data: entries }, { data: flags }] = await Promise.all([
    db().from('documents').select('id,status,image_path').eq('client_id', clientId),
    db().from('entries').select('*').eq('client_id', clientId).order('entry_date', { ascending: false }),
    db().from('flags').select('entry_id,detail').eq('client_id', clientId).eq('open', true),
  ]);
  const review = (entries ?? []).filter((e) => !e.confirmed);
  const rows: ReviewRow[] = await Promise.all(
    review.map(async (e) => {
      const path = docs?.find((d) => d.id === e.document_id)?.image_path;
      const signed = path ? (await db().storage.from('receipts').createSignedUrl(path, 3600)).data?.signedUrl ?? null : null;
      return {
        id: e.id, documentId: e.document_id, vendor: e.vendor, date: e.entry_date, subtotal: Number(e.subtotal), vat: Number(e.vat),
        total: Number(e.total), category: e.category, question: e.question, agreement: e.agreement ?? {}, imageUrl: signed,
        flags: (flags ?? []).filter((f) => f.entry_id === e.id).map((f) => f.detail),
      };
    }),
  );
  const month = monthKey(new Date());
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <LiveRefresh />
      <Link href="/board" className="text-sm text-neutral-500">← لوحة العملاء</Link>
      <h1 className="text-2xl font-semibold">{client.name}</h1>
      <ReviewTable rows={rows} failed={(docs ?? []).filter((d) => d.status === 'failed')} />
      <p className="text-sm text-neutral-500">
        الشهر {month}: <a className="text-[var(--accent)]" href={`/api/export/${client.id}?month=${month}&format=xlsx`}>Excel</a>{' · '}
        <a className="text-[var(--accent)]" href={`/api/export/${client.id}?month=${month}&format=pdf`}>PDF</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 7: Add-client form and client link (so a new sign-up can use the app)**

Append to `src/server/actions.ts`:
```ts
export async function createClientAction(form: FormData) {
  const { officeId } = await requireOffice();
  const name = String(form.get('name') ?? '').trim();
  const nameEn = String(form.get('name_en') ?? '').trim() || name;
  if (!name) return;
  await db().from('clients').insert({ office_id: officeId, name, name_en: nameEn });
  revalidatePath('/board');
}
```
In `src/app/board/page.tsx`, below the `<ul>`, add:
```tsx
<form action={createClientAction} className="mt-6 flex flex-wrap gap-2">
  <input name="name" required placeholder="اسم العميل" className="flex-1 rounded-xl border px-3 py-2" />
  <input name="name_en" placeholder="Name (English, for PDF)" dir="ltr" className="flex-1 rounded-xl border px-3 py-2" />
  <button className="rounded-full bg-[var(--accent)] px-5 text-white">إضافة عميل</button>
</form>
```
(import `createClientAction` from `@/server/actions`). In `src/app/board/[clientId]/page.tsx`, under the title, show the client's upload link so the accountant can share or print it:
```tsx
<p className="text-sm text-neutral-500" dir="ltr">/c/{client.token}</p>
```

- [ ] **Step 8: Verify, including cross-office isolation**

Upload a receipt, open the client detail page.
Expected: the new entry shows with image, disputed fields highlighted, flags in red. Edit a field, tick, click confirm: row disappears, flag closes, board status moves toward `ready`. Entry with total 0 is skipped by confirm.
Isolation: sign up a second user in a private window, add a client, then paste the first user's `/board/<clientId>` URL: expect 404. Submit another office's entry id to `confirmEntries` (browser devtools, replace one id in the request): expect no change in the database.

- [ ] **Step 8: Commit**

```bash
git add src && git commit -m "feat: review table with bulk confirm and retry" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Cron sweep, chaser (priority 5)

**Files:**
- Create: `src/app/api/jobs/sweep/route.ts`, `vercel.json`, `src/app/board/[clientId]/Reminder.tsx`
- Modify: `src/server/actions.ts` (add `draftReminderAction`), `src/app/board/[clientId]/page.tsx`

**Interfaces:**
- Consumes: `buildReminderMessages` (Task 5), `chatText` (Task 7), `loadBoard` (Task 11).
- Produces: `draftReminderAction(clientId:string):Promise<string>` (draft text; empty string means nothing is missing); `GET /api/jobs/sweep` (header `authorization: Bearer $CRON_SECRET`).

- [ ] **Step 1: Create `src/app/api/jobs/sweep/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { drain } from '@/server/jobs';
import { supabaseJobStore } from '@/server/jobStore';
import { handlers, onDead } from '@/server/processDocument';

export const maxDuration = 60;

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const n = await drain(supabaseJobStore(), handlers, { limit: 10, onDead });
  return NextResponse.json({ ran: n });
}
```

`vercel.json`:
```json
{ "crons": [{ "path": "/api/jobs/sweep", "schedule": "* * * * *" }] }
```
If the Vercel plan rejects per-minute crons, change to `0 0 * * *`; in-process retries in Task 8 keep the demo working either way.

- [ ] **Step 2: Add `draftReminderAction` to `src/server/actions.ts`**

```ts
import { buildReminderMessages } from '@/brain/draft/reminder';
import { chatText } from './ai';
import { loadBoard, monthKey } from './queries';

export async function draftReminderAction(clientId: string): Promise<string> {
  const { officeId } = await requireOffice();
  const row = (await loadBoard(officeId)).find((r) => r.id === clientId); // office-scoped, so another office's id finds nothing
  if (!row) return '';
  const missing = row.counts.missing.length ? row.counts.missing : row.status === 'silent' ? ['إيصالات هذا الشهر'] : [];
  if (!missing.length) return '';
  return chatText(buildReminderMessages({ clientName: row.name, month: monthKey(new Date()), missing }));
}
```
Imports go at the top of the file with the others (the file already has `'use server'` first).

- [ ] **Step 3: Create `src/app/board/[clientId]/Reminder.tsx`**

```tsx
'use client';
import { useState, useTransition } from 'react';
import { draftReminderAction } from '@/server/actions';

export function Reminder({ clientId, show }: { clientId: string; show: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!show) return null;
  return (
    <section className="space-y-2 rounded-2xl bg-amber-50 p-4">
      <button disabled={pending} onClick={() => start(async () => setText(await draftReminderAction(clientId)))} className="rounded-full bg-amber-600 px-4 py-1 text-sm text-white">
        {pending ? '…' : 'اكتب رسالة تذكير'}
      </button>
      {text !== null && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full rounded-lg border p-2 text-sm" />
          <button className="text-sm underline" onClick={() => navigator.clipboard.writeText(text)}>نسخ</button>
          <p className="text-xs text-neutral-500">مسودة فقط. أنت من يرسلها.</p>
        </>
      )}
    </section>
  );
}
```
In `page.tsx` add above `<ReviewTable>`: `<Reminder clientId={client.id} show={board.status === 'missing' || board.status === 'silent'} />`, where `const board = (await loadBoard(officeId)).find((r) => r.id === clientId)!;` (import `loadBoard`; `officeId` is already in scope from `requireOffice()`).

- [ ] **Step 4: Verify**

Seed data comes in Task 15. For now, insert an `expected_docs` row (vendor `Landlord`, label `إيصال الإيجار`) for a client with no `Landlord` entry this month. Open the client page.
Expected: amber reminder box; click returns Arabic text listing only the rent receipt. `curl -H "authorization: Bearer $CRON_SECRET" localhost:3000/api/jobs/sweep` returns `{"ran":0}` or more; without header returns 403.

- [ ] **Step 5: Commit**

```bash
git add src vercel.json && git commit -m "feat: cron sweep and Arabic reminder drafting" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Seed data and sample receipts

**Files:**
- Create: `scripts/seed.ts`, `samples/README.md`, `samples/ground-truth.json`, `samples/01.html` through `samples/10.html` (printable invented receipts), `scripts/score-extraction.ts`

**Interfaces:**
- Produces: `npm run seed` wipes and recreates the demo office, 5 clients with tokens printed to the console, 3 months of confirmed entries each with the built-in stories; `npm run score` prints per-field accuracy of `extractReceipt` over `samples/photos/*.jpg` vs `samples/ground-truth.json`.

- [ ] **Step 1: Create `scripts/seed.ts`**

```ts
import 'dotenv/config';
import { db } from '../src/server/db';
import { DEMO } from '../src/lib/demo';
import { monthKey, shiftMonth } from '../src/server/queries';

const cur = monthKey(new Date());
const d = (m: string, day: number) => `${m}-${String(day).padStart(2, '0')}`;
const row = (m: string, day: number, vendor: string, subtotal: number, category: string, vatRate = 0.14) => {
  const vat = Math.round(subtotal * vatRate * 100) / 100;
  return { vendor, entry_date: d(m, day), subtotal, vat, total: Math.round((subtotal + vat) * 100) / 100, category, confirmed: true };
};

async function main() {
  // Wipe only the demo office and demo user, never other users' offices.
  const { data: users } = await db().auth.admin.listUsers({ perPage: 200 });
  const old = users.users.find((u) => u.email === DEMO.email);
  if (old) await db().auth.admin.deleteUser(old.id);
  await db().from('offices').delete().eq('name', 'مكتب أحمد (تجريبي)');
  const { data: office } = await db().from('offices').insert({ name: 'مكتب أحمد (تجريبي)' }).select('id').single();
  const { data: demoUser } = await db().auth.admin.createUser({ email: DEMO.email, password: DEMO.password, email_confirm: true });
  await db().from('office_members').insert({ user_id: demoUser.user!.id, office_id: office!.id });
  const mk = async (name: string, name_en: string) =>
    (await db().from('clients').insert({ office_id: office!.id, name, name_en }).select('id,token').single()).data!;
  const months = [shiftMonth(cur, -2), shiftMonth(cur, -1), cur];

  const clients = {
    mona: await mk('منى للمستلزمات المنزلية', 'Mona Home Goods'),
    cafe: await mk('كافيه النيل', 'Nile Cafe'),
    acc: await mk('عالم الإكسسوارات', 'Accessories World'),
    alu: await mk('ورشة الألومنيوم', 'Aluminium Workshop'),
    insta: await mk('متجر إنستجرام للملابس', 'Insta Clothing'),
  };
  const put = async (client: { id: string }, rows: ReturnType<typeof row>[]) =>
    db().from('entries').insert(rows.map((r) => ({ ...r, client_id: client.id })));

  // Mona: supplier price jump of 9% this month, margin dips.
  await put(clients.mona, [
    ...months.slice(0, 2).flatMap((m) => [row(m, 3, 'مبيعات المحل', 9000, 'sales'), row(m, 5, 'مورد الأدوات المنزلية', 4000, 'supplies'), row(m, 1, 'المالك', 1500, 'rent', 0)]),
    row(cur, 3, 'مبيعات المحل', 9000, 'sales'), row(cur, 5, 'مورد الأدوات المنزلية', 4360, 'supplies'), row(cur, 1, 'المالك', 1500, 'rent', 0),
  ]);
  // Cafe: rent receipt missing this month (expected_docs below).
  await put(clients.cafe, months.flatMap((m) => [row(m, 2, 'مبيعات الكافيه', 6000, 'sales'), row(m, 4, 'مورد البن', 1800, 'supplies'), ...(m === cur ? [] : [row(m, 1, 'المالك', 2000, 'rent', 0)])]));
  // Accessories: duplicate invoice this month.
  await put(clients.acc, [
    ...months.slice(0, 2).flatMap((m) => [row(m, 3, 'مبيعات', 5000, 'sales'), row(m, 6, 'مستورد الإكسسوارات', 2000, 'supplies')]),
    row(cur, 3, 'مبيعات', 5000, 'sales'), row(cur, 6, 'مستورد الإكسسوارات', 2000, 'supplies'), { ...row(cur, 6, 'مستورد الإكسسوارات', 2000, 'supplies'), confirmed: false },
  ]);
  // Aluminium workshop: unusually high VAT this month.
  await put(clients.alu, [
    ...months.slice(0, 2).flatMap((m) => [row(m, 4, 'مبيعات الورشة', 12000, 'sales'), row(m, 7, 'مورد الألومنيوم', 5000, 'supplies')]),
    row(cur, 4, 'مبيعات الورشة', 12000, 'sales'), row(cur, 7, 'مورد الألومنيوم', 20000, 'supplies'),
  ]);
  // Instagram seller: nothing this month.
  await put(clients.insta, months.slice(0, 2).flatMap((m) => [row(m, 5, 'مبيعات إنستجرام', 7000, 'sales', 0), row(m, 8, 'مورد الملابس', 3000, 'supplies')]));

  await db().from('expected_docs').insert([
    { client_id: clients.mona.id, vendor: 'المالك', label: 'إيصال الإيجار' },
    { client_id: clients.cafe.id, vendor: 'المالك', label: 'إيصال الإيجار' },
    { client_id: clients.cafe.id, vendor: 'مورد البن', label: 'فاتورة مورد البن' },
  ]);
  await db().from('employees').insert([
    { client_id: clients.mona.id, name: 'سارة', monthly_wage: 7000 },
    { client_id: clients.mona.id, name: 'كريم', monthly_wage: 9000 },
    { client_id: clients.cafe.id, name: 'مصطفى', monthly_wage: 7500 },
  ]);

  // Flags matching the stories (the pipeline creates these for live uploads; seeded history needs them directly).
  const { data: monaEntry } = await db().from('entries').select('id').eq('client_id', clients.mona.id).eq('vendor', 'مورد الأدوات المنزلية').eq('entry_date', d(cur, 5)).single();
  const { data: dupEntry } = await db().from('entries').select('id').eq('client_id', clients.acc.id).eq('confirmed', false).single();
  const { data: aluEntry } = await db().from('entries').select('id').eq('client_id', clients.alu.id).eq('vendor', 'مورد الألومنيوم').eq('entry_date', d(cur, 7)).single();
  await db().from('flags').insert([
    { client_id: clients.mona.id, entry_id: monaEntry!.id, kind: 'price_jump', detail: 'مورد الأدوات المنزلية ارتفع 9% عن المتوسط السابق' },
    { client_id: clients.acc.id, entry_id: dupEntry!.id, kind: 'duplicate', detail: 'نفس فاتورة مستورد الإكسسوارات مسجلة مرتين' },
    { client_id: clients.alu.id, entry_id: aluEntry!.id, kind: 'vat_spike', detail: 'ضريبة القيمة المضافة أعلى من المعتاد' },
  ]);

  for (const [k, c] of Object.entries(clients)) console.log(k.padEnd(6), `/c/${c.token}`);
}
main();
```
Run `npm i -D dotenv` first. Note: `loadBoard` reads `.env.local` through Next; for the script, `dotenv/config` reads `.env`, so run `cp .env.local .env` locally (`.env` is git-ignored by create-next-app's `.gitignore`, verify with `git check-ignore .env`).

- [ ] **Step 2: Run the seed and verify the stories**

Run: `npm run seed`
Expected: five lines of `/c/<token>`. Open `/board`:
- Mona: `strange` (price jump), Cafe: `missing`, Accessories: `strange` (duplicate), Workshop: `strange` (VAT), Instagram: `silent`. If any shows `ready`, fix the seed or the status query before moving on.

- [ ] **Step 3: Create sample receipts and ground truth**

`samples/ground-truth.json` (10 invented receipts; the HTML files render exactly these):
```json
[
  { "file": "01", "vendor": "Spinneys", "date": "2026-10-05", "subtotal": 100, "vat": 14, "total": 114, "docType": "purchase" },
  { "file": "02", "vendor": "مورد الأدوات المنزلية", "date": "2026-10-04", "subtotal": 4360, "vat": 610.4, "total": 4970.4, "docType": "purchase" },
  { "file": "03", "vendor": "المالك", "date": "2026-10-01", "subtotal": 1500, "vat": 0, "total": 1500, "docType": "purchase" },
  { "file": "04", "vendor": "مورد البن", "date": "2026-10-03", "subtotal": 1800, "vat": 252, "total": 2052, "docType": "purchase" },
  { "file": "05", "vendor": "Gulf Supplies", "date": "2026-10-06", "subtotal": 250, "vat": 35, "total": 285, "docType": "purchase" },
  { "file": "06", "vendor": "كافيه النيل", "date": "2026-10-06", "subtotal": 80, "vat": 11.2, "total": 91.2, "docType": "sale" },
  { "file": "07", "vendor": "مستورد الإكسسوارات", "date": "2026-10-06", "subtotal": 2000, "vat": 280, "total": 2280, "docType": "purchase" },
  { "file": "08", "vendor": "مورد الألومنيوم", "date": "2026-10-07", "subtotal": 20000, "vat": 2800, "total": 22800, "docType": "purchase" },
  { "file": "09", "vendor": "Vodafone Egypt", "date": "2026-10-02", "subtotal": 300, "vat": 42, "total": 342, "docType": "purchase" },
  { "file": "10", "vendor": "محل الحاج علي", "date": "2026-10-08", "subtotal": null, "vat": null, "total": 120, "docType": "purchase" }
]
```
Create `samples/01.html` to `10.html` as simple narrow (`max-width: 300px`) monospaced receipts, each showing the vendor, date, line `Subtotal`, `VAT 14%`, `Total` (use Arabic-Indic digits in files 02, 06, 08 and plain digits in the rest; file 10 shows the total only). Write `samples/README.md` explaining: invented data only; print each page, photograph with a phone (include a crumpled one and a dim one), save as `samples/photos/NN.jpg` (git-ignored).

- [ ] **Step 4: Create `scripts/score-extraction.ts`**

```ts
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { extractReceipt } from '../src/server/extractReceipt';

type Truth = { file: string; vendor: string; date: string; subtotal: number | null; vat: number | null; total: number; docType: string };
const truth: Truth[] = JSON.parse(readFileSync('samples/ground-truth.json', 'utf8'));
const FIELDS = ['vendor', 'date', 'subtotal', 'vat', 'total'] as const;
const hit: Record<string, number> = Object.fromEntries(FIELDS.map((f) => [f, 0]));
let n = 0;

async function main() {
  for (const t of truth) {
    const p = `samples/photos/${t.file}.jpg`;
    if (!existsSync(p)) continue;
    n++;
    const r = await extractReceipt(readFileSync(p).toString('base64'), 'image/jpeg');
    for (const f of FIELDS) {
      const got = r.fields[f].value;
      const want = t[f];
      const ok = typeof want === 'number' ? Math.abs(Number(got) - want) < 0.01 : String(got ?? '').trim().toLowerCase() === String(want ?? '').trim().toLowerCase();
      if (ok) hit[f]++;
      else console.log(`${t.file} ${f}: got ${JSON.stringify(got)} want ${JSON.stringify(want)} [${r.fields[f].agreement}]`);
    }
  }
  console.log(`\n${n} receipts`, Object.fromEntries(FIELDS.map((f) => [f, `${hit[f]}/${n}`])));
}
main();
```

- [ ] **Step 4b: Score and decide**

Photograph the printed samples, run `npm run score`.
Expected: totals correct on at least 9 of 10. If one lane drags accuracy down, set `FUSION=off` and rerun to compare; record the result in `docs/notes/extraction-score.md`. If both lanes are below 8/10 on totals, stop and report before building further.

- [ ] **Step 5: Commit**

```bash
git add scripts samples package.json package-lock.json && git commit -m "feat: demo seed with built-in stories, sample receipts, extraction scorer" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Agent chat (priority 6)

**Files:**
- Create: `src/server/askTools.ts`, `src/app/api/chat/route.ts`, `src/app/chat/page.tsx`, `src/app/chat/Chat.tsx`
- Test: `src/server/askTools.test.ts`

**Interfaces:**
- Consumes: `askLoop`, `ASK_SYSTEM_PROMPT`, `ToolDef`, `Msg` (Task 5); `profitAndLoss`, `vatSummary`, `priceChanges` (Task 2); `gptLlm`, `chatText` (Task 7); `loadBoard`, `mapEntry`, `monthKey`, `shiftMonth` (Task 11); `buildReminderMessages`.
- Produces: `buildTools(officeId:string): ToolDef[]` (every tool only sees that office's clients) with `clients_without_uploads({month})`, `margin_change({client, month})`, `vat_by_client({month})`, `top_price_changes({client, month})`, `draft_reminder({client})`; `POST /api/chat` body `{messages:{role:'user'|'assistant'; content:string}[]}` returns `{answer:string}`. `resolveClient(name:string, clients:{id:string;name:string;name_en:string}[]): {id:string;name:string}|null` (case-insensitive substring match on Arabic or English name, null if zero or ambiguous).

- [ ] **Step 1: Write failing test `src/server/askTools.test.ts`**

```ts
import { expect, it } from 'vitest';
import { resolveClient } from './askTools';

const clients = [
  { id: '1', name: 'منى للمستلزمات المنزلية', name_en: 'Mona Home Goods' },
  { id: '2', name: 'كافيه النيل', name_en: 'Nile Cafe' },
  { id: '3', name: 'متجر النيل للملابس', name_en: 'Nile Clothing' },
];
it('matches Arabic or English substring', () => {
  expect(resolveClient('mona', clients)?.id).toBe('1');
  expect(resolveClient('منى', clients)?.id).toBe('1');
});
it('ambiguous or unknown returns null', () => {
  expect(resolveClient('nile', clients)).toBeNull();
  expect(resolveClient('zzz', clients)).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**, `npx vitest run src/server/askTools.test.ts`. Expected FAIL.

- [ ] **Step 3: Create `src/server/askTools.ts`**

```ts
import type { ToolDef } from '@/brain/ask/loop';
import { buildReminderMessages } from '@/brain/draft/reminder';
import { priceChanges, profitAndLoss, vatSummary } from '@/brain/ledger';
import { chatText } from './ai';
import { db } from './db';
import { loadBoard, mapEntry, monthKey, shiftMonth } from './queries';

type C = { id: string; name: string; name_en: string };

export function resolveClient(q: string, clients: C[]) {
  const s = q.trim().toLowerCase();
  const m = clients.filter((c) => c.name.toLowerCase().includes(s) || c.name_en.toLowerCase().includes(s));
  return m.length === 1 ? { id: m[0].id, name: m[0].name } : null;
}

const month = { type: 'string', description: 'Month as YYYY-MM. Use the current month if the user does not say.' };
const client = { type: 'string', description: 'Client name in Arabic or English' };
const obj = (properties: object, required: string[]) => ({ type: 'object', properties, required, additionalProperties: false });

async function entriesOf(clientId: string, m: string) {
  const { data } = await db().from('entries').select('*').eq('client_id', clientId).gte('entry_date', `${m}-01`).lt('entry_date', `${shiftMonth(m, 1)}-01`);
  return (data ?? []).map(mapEntry);
}
const allClients = async (officeId: string) => ((await db().from('clients').select('id,name,name_en').eq('office_id', officeId)).data ?? []) as C[];
const notFound = (n: string) => ({ error: `client not found or ambiguous: ${n}` });

export function buildTools(officeId: string): ToolDef[] {
  return [
    {
      name: 'clients_without_uploads', description: 'Clients that have no uploads or entries in the month', parameters: obj({ month }, ['month']),
      run: async ({ month: m }) => ({ month: m, clients: (await loadBoard(officeId, new Date(`${m}-15`))).filter((r) => r.counts.uploads === 0).map((r) => r.name) }),
    },
    {
      name: 'margin_change', description: 'Profit and loss and margin for a client in a month versus the previous month, with the vendors whose prices changed most',
      parameters: obj({ client, month }, ['client', 'month']),
      run: async ({ client: q, month: m }) => {
        const c = resolveClient(q, await allClients(officeId));
        if (!c) return notFound(q);
        const [cur, prev] = [await entriesOf(c.id, m), await entriesOf(c.id, shiftMonth(m, -1))];
        return { client: c.name, month: m, current: profitAndLoss(cur), previous: { month: shiftMonth(m, -1), ...profitAndLoss(prev) }, priceChanges: priceChanges(prev, cur).slice(0, 3) };
      },
    },
    {
      name: 'vat_by_client', description: 'VAT payable per client for a month (confirmed entries only)', parameters: obj({ month }, ['month']),
      run: async ({ month: m }) => ({
        month: m,
        clients: await Promise.all((await allClients(officeId)).map(async (c) => ({ client: c.name, ...vatSummary(await entriesOf(c.id, m)) }))),
      }),
    },
    {
      name: 'top_price_changes', description: 'Vendors whose average price changed most for a client versus the previous month', parameters: obj({ client, month }, ['client', 'month']),
      run: async ({ client: q, month: m }) => {
        const c = resolveClient(q, await allClients(officeId));
        if (!c) return notFound(q);
        return { client: c.name, month: m, changes: priceChanges(await entriesOf(c.id, shiftMonth(m, -1)), await entriesOf(c.id, m)) };
      },
    },
    {
      name: 'draft_reminder', description: 'Draft (never send) an Arabic reminder to a client listing their missing documents', parameters: obj({ client }, ['client']),
      run: async ({ client: q }) => {
        const c = resolveClient(q, await allClients(officeId));
        if (!c) return notFound(q);
        const row = (await loadBoard(officeId)).find((r) => r.id === c.id)!;
        if (!row.counts.missing.length) return { client: c.name, draft: null, note: 'nothing is missing' };
        return { client: c.name, month: monthKey(new Date()), draft: await chatText(buildReminderMessages({ clientName: c.name, month: monthKey(new Date()), missing: row.counts.missing })) };
      },
    },
  ];
}
```

- [ ] **Step 4: Run to verify pass**, `npx vitest run src/server/askTools.test.ts`. Expected PASS.

- [ ] **Step 5: Create `src/app/api/chat/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { ASK_SYSTEM_PROMPT, askLoop, type Msg } from '@/brain/ask/loop';
import { gptLlm } from '@/server/ai';
import { requireOffice } from '@/server/auth';
import { buildTools } from '@/server/askTools';
import { monthKey } from '@/server/queries';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { officeId } = await requireOffice();
  const { messages } = (await req.json()) as { messages: { role: 'user' | 'assistant'; content: string }[] };
  if (!Array.isArray(messages) || !messages.length) return NextResponse.json({ error: 'no messages' }, { status: 400 });
  const history: Msg[] = [
    { role: 'system', content: `${ASK_SYSTEM_PROMPT}\nCurrent month: ${monthKey(new Date())}.` },
    ...messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }) as Msg),
  ];
  const r = await askLoop(gptLlm(), buildTools(officeId), history);
  return NextResponse.json({ answer: r.answer });
}
```

- [ ] **Step 6: Create `src/app/chat/page.tsx` and `Chat.tsx`**

`page.tsx`:
```tsx
import Link from 'next/link';
import { Chat } from './Chat';
export default function ChatPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-6">
      <Link href="/board" className="text-sm text-neutral-500">← لوحة العملاء</Link>
      <Chat />
    </main>
  );
}
```
`Chat.tsx`:
```tsx
'use client';
import { useState } from 'react';

type M = { role: 'user' | 'assistant'; content: string };
const SUGGEST = ['من لم يرسل مستندات هذا الشهر؟', 'لماذا انخفض هامش ربح منى؟', 'ما ضريبة القيمة المضافة المستحقة لكل عميل؟'];

export function Chat() {
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(q: string) {
    if (!q.trim() || busy) return;
    const next = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      const j = await r.json();
      setMsgs([...next, { role: 'assistant', content: j.answer ?? 'تعذّر الرد' }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex-1 space-y-3">
        {!msgs.length && SUGGEST.map((s) => <button key={s} onClick={() => send(s)} className="block rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-600">{s}</button>)}
        {msgs.map((m, i) => (
          <p key={i} className={`whitespace-pre-wrap rounded-2xl p-3 ${m.role === 'user' ? 'bg-neutral-100' : 'bg-teal-50'}`}>{m.content}</p>
        ))}
        {busy && <p className="text-neutral-400">…</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} className="flex-1 rounded-full border px-4 py-2" placeholder="اسأل عن عملائك" />
        <button className="rounded-full bg-[var(--accent)] px-5 text-white">إرسال</button>
      </form>
      <p className="text-xs text-neutral-400">قيد يحضّر والمحاسب يقرر. الأرقام تأتي من السجلات.</p>
    </div>
  );
}
```

- [ ] **Step 7: Verify the demo questions**

With seed data loaded, ask in `/chat`: "Who hasn't sent documents this month?", "Why did Mona's margin drop?".
Expected: first names Instagram seller (and only clients with zero uploads), second cites the supplier price rise of 9% with figures from `margin_change`; each answer names client and month. Ask about a client that does not exist: expected the "not enough information" style answer, not invented numbers.

- [ ] **Step 8: Commit**

```bash
git add src && git commit -m "feat: agent chat with deterministic tools" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Month-end pack, Excel and PDF (priority 7)

**Files:**
- Create: `src/brain/export/xlsx.ts`, `src/brain/export/pack.tsx`, `src/app/api/export/[clientId]/route.ts`
- Test: `src/brain/export/export.test.ts`

**Interfaces:**
- Consumes: `profitAndLoss`, `vatSummary`, `payroll` (Task 2); `Entry`.
- Produces:
  - `type PackInput = { clientName: string; month: string; entries: Entry[]; employees: {name:string; wage:number}[] }`
  - `buildWorkbook(i:PackInput): Promise<Buffer>` sheets `Entries`, `P&L`, `VAT`, `Payroll`
  - `buildPdf(i:PackInput): Promise<Buffer>`
  - `GET /api/export/[clientId]?month=YYYY-MM&format=xlsx|pdf`

- [ ] **Step 1: Write failing tests `src/brain/export/export.test.ts`**

```ts
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { profitAndLoss, vatSummary } from '../ledger';
import { buildPdf } from './pack';
import { buildWorkbook, type PackInput } from './xlsx';
import type { Entry } from '../types';

const e = (o: Partial<Entry>): Entry => ({ id: String(Math.random()), clientId: 'c', documentId: null, vendor: 'v', date: '2026-10-05', subtotal: 100, vat: 14, total: 114, category: 'supplies', confirmed: true, ...o });
const input: PackInput = {
  clientName: 'Mona Home Goods', month: '2026-10',
  entries: [e({ category: 'sales', subtotal: 1000, vat: 140, total: 1140 }), e({ subtotal: 200, vat: 28, total: 228 }), e({ confirmed: false, subtotal: 9999, total: 9999 })],
  employees: [{ name: 'Sara', wage: 7000 }],
};

describe('buildWorkbook', () => {
  it('has the four sheets and totals equal ledger totals', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildWorkbook(input)) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Entries', 'P&L', 'VAT', 'Payroll']);
    const pl = wb.getWorksheet('P&L')!;
    expect((pl.getCell('B4').value as { result: number }).result).toBe(profitAndLoss(input.entries).net);
    const vat = wb.getWorksheet('VAT')!;
    expect((vat.getCell('B4').value as { result: number }).result).toBe(vatSummary(input.entries).payable);
  });
  it('excludes unconfirmed entries from the Entries sheet', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildWorkbook(input)) as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Entries')!.rowCount).toBe(1 + 2 + 1); // header + 2 confirmed + totals
  });
});

describe('buildPdf', () => {
  it('produces a PDF', async () => {
    const buf = await buildPdf(input);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
```

- [ ] **Step 2: Run to verify failure**, `npx vitest run src/brain/export`. Expected FAIL.

- [ ] **Step 3: Implement `src/brain/export/xlsx.ts`**

```ts
import ExcelJS from 'exceljs';
import { RATES } from '../config';
import { payroll, profitAndLoss, vatSummary } from '../ledger';
import type { Entry } from '../types';

export type PackInput = { clientName: string; month: string; entries: Entry[]; employees: { name: string; wage: number }[] };

export async function buildWorkbook(i: PackInput): Promise<Buffer> {
  const confirmed = i.entries.filter((e) => e.confirmed);
  const pl = profitAndLoss(i.entries);
  const vat = vatSummary(i.entries);
  const pay = payroll(i.employees);
  const wb = new ExcelJS.Workbook();

  const en = wb.addWorksheet('Entries');
  en.addRow(['Date', 'Vendor', 'Category', 'Subtotal', 'VAT', 'Total']);
  confirmed.forEach((e) => en.addRow([e.date, e.vendor, e.category, e.subtotal, e.vat, e.total]));
  const last = confirmed.length + 1;
  const sumOf = (col: string, field: 'subtotal' | 'vat' | 'total') => ({ formula: `SUM(${col}2:${col}${last})`, result: Math.round(confirmed.reduce((s, e) => s + e[field], 0) * 100) / 100 });
  en.addRow(['Total', '', '', sumOf('D', 'subtotal'), sumOf('E', 'vat'), sumOf('F', 'total')]);

  const p = wb.addWorksheet('P&L');
  p.addRow([`${i.clientName} ${i.month}`]);
  p.addRow(['Revenue (net of VAT)', pl.revenue]);
  p.addRow(['Expenses', pl.totalExpenses]);
  p.addRow(['Net profit', { formula: 'B2-B3', result: pl.net }]);
  Object.entries(pl.expensesByCategory).forEach(([c, v]) => p.addRow([`  ${c}`, v]));

  const v = wb.addWorksheet('VAT');
  v.addRow([`VAT rate ${RATES.vat * 100}% (to verify)`]);
  v.addRow(['Output VAT', vat.outputVat]);
  v.addRow(['Input VAT', vat.inputVat]);
  v.addRow(['Payable', { formula: 'B2-B3', result: vat.payable }]);

  const w = wb.addWorksheet('Payroll');
  w.addRow(['Name', 'Wage', 'Insurable wage', 'Employee share', 'Employer share']);
  pay.rows.forEach((r) => w.addRow([r.name, r.wage, r.insurable, r.employee, r.employer]));
  w.addRow(['Total', '', '', pay.totalEmployee, pay.totalEmployer]);
  w.addRow([`Social insurance rates to verify: employee ${RATES.socialInsurance.employee * 100}%, employer ${RATES.socialInsurance.employer * 100}%`]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
```
`P&L` row numbers: row 1 title, row 2 revenue, row 3 expenses, row 4 net (so `B4` is net). `VAT` row 4 is payable. The test relies on that layout.

- [ ] **Step 4: Implement `src/brain/export/pack.tsx`**

```tsx
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { RATES } from '../config';
import { payroll, profitAndLoss, vatSummary } from '../ledger';
import type { PackInput } from './xlsx';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' },
  h1: { fontSize: 18, marginBottom: 4 },
  note: { color: '#777', marginBottom: 16 },
  h2: { fontSize: 13, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
});
const Row = ({ a, b }: { a: string; b: string | number }) => (
  <View style={s.row}><Text>{a}</Text><Text>{String(b)}</Text></View>
);

// ponytail: client name uses name_en because react-pdf Arabic shaping is unverified.
export async function buildPdf(i: PackInput): Promise<Buffer> {
  const pl = profitAndLoss(i.entries);
  const vat = vatSummary(i.entries);
  const pay = payroll(i.employees);
  return renderToBuffer(
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{i.clientName} - {i.month}</Text>
        <Text style={s.note}>Prepared for accountant review. Not filed or submitted. Invented demo data.</Text>
        <Text style={s.h2}>Profit and loss (EGP)</Text>
        <Row a="Revenue (net of VAT)" b={pl.revenue} />
        {Object.entries(pl.expensesByCategory).map(([c, v]) => <Row key={c} a={`Expense: ${c}`} b={v} />)}
        <Row a="Net profit" b={pl.net} />
        <Row a="Margin" b={pl.margin == null ? 'n/a' : `${Math.round(pl.margin * 100)}%`} />
        <Text style={s.h2}>VAT summary (rate {RATES.vat * 100}%, to verify)</Text>
        <Row a="Output VAT" b={vat.outputVat} />
        <Row a="Input VAT" b={vat.inputVat} />
        <Row a="Payable" b={vat.payable} />
        <Text style={s.h2}>Payroll and social insurance (rates to verify)</Text>
        {pay.rows.map((r) => <Row key={r.name} a={`${r.name} (employee / employer)`} b={`${r.employee} / ${r.employer}`} />)}
        <Row a="Totals" b={`${pay.totalEmployee} / ${pay.totalEmployer}`} />
      </Page>
    </Document>,
  );
}
```
Because the PDF cannot render Arabic reliably, the export route passes `name_en` as `clientName` for PDF and the Arabic name for Excel.

- [ ] **Step 5: Create `src/app/api/export/[clientId]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { buildPdf } from '@/brain/export/pack';
import { buildWorkbook, type PackInput } from '@/brain/export/xlsx';
import { requireOffice } from '@/server/auth';
import { db } from '@/server/db';
import { mapEntry, monthKey, shiftMonth } from '@/server/queries';

export async function GET(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { officeId } = await requireOffice();
  const url = new URL(req.url);
  const month = url.searchParams.get('month') ?? monthKey(new Date());
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'bad month' }, { status: 400 });

  const { data: c } = await db().from('clients').select('id,name,name_en').eq('id', clientId).eq('office_id', officeId).maybeSingle();
  if (!c) return NextResponse.json({ error: 'not found' }, { status: 404 }); // also the answer for another office's client id
  const [{ data: es }, { data: emps }] = await Promise.all([
    db().from('entries').select('*').eq('client_id', clientId).gte('entry_date', `${month}-01`).lt('entry_date', `${shiftMonth(month, 1)}-01`),
    db().from('employees').select('name,monthly_wage').eq('client_id', clientId),
  ]);
  const input: PackInput = {
    clientName: format === 'pdf' ? c.name_en : c.name, month,
    entries: (es ?? []).map(mapEntry),
    employees: (emps ?? []).map((e) => ({ name: e.name, wage: Number(e.monthly_wage) })),
  };
  const buf = format === 'pdf' ? await buildPdf(input) : await buildWorkbook(input);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="qaid-${c.name_en.replace(/\W+/g, '-')}-${month}.${format}"`,
    },
  });
}
```

- [ ] **Step 6: Run to verify pass**, `npx vitest run src/brain/export`
Expected: all pass. If the PDF test fails to import `@react-pdf/renderer` in Vitest, set `test.server.deps.inline: ['@react-pdf/renderer']` in `vitest.config.ts`.

- [ ] **Step 7: Verify the download**

With seed data, open `/board/<mona id>` and click Excel and PDF.
Expected: Excel opens with 4 sheets, net profit equals the number the chat gave for Mona; PDF shows English labels and the "Prepared for accountant review" stamp.

- [ ] **Step 8: Commit**

```bash
git add src vitest.config.ts && git commit -m "feat: month-end pack as Excel and PDF" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Smart scan A, capture assist (client side)

**Files:**
- Create: `src/brain/scan/quality.ts`, `src/app/c/[token]/scan.ts`
- Modify: `src/app/c/[token]/Uploader.tsx`, `src/i18n/dict.ts` (already has `retake`)
- Test: `src/brain/scan/quality.test.ts`

**Interfaces:**
- Produces:
  - `toGray(rgba:Uint8ClampedArray):Uint8ClampedArray`
  - `blurScore(gray:Uint8ClampedArray, w:number, h:number):number` (variance of the Laplacian, higher is sharper)
  - `brightness(gray:Uint8ClampedArray):number` (mean 0 to 255)
  - `assess(gray, w, h): {ok:boolean; reason:'blurry'|'dark'|'bright'|null}` with thresholds `BLUR_MIN=60`, `DARK_MAX=45`, `BRIGHT_MIN=245`
  - `receiptBox(gray, w, h): {x:number;y:number;w:number;h:number}` bounding box of pixels brighter than Otsu-like threshold (mean + 0.5*std), falls back to full frame
  - `scan.ts`: `checkAndCrop(file:File): Promise<{blob:Blob; ok:boolean; reason:string|null}>`

- [ ] **Step 1: Write failing tests `src/brain/scan/quality.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { assess, blurScore, brightness, receiptBox } from './quality';

const img = (w: number, h: number, f: (x: number, y: number) => number) => {
  const a = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = f(x, y);
  return a;
};

describe('blurScore', () => {
  it('sharp checkerboard scores higher than flat', () => {
    const sharp = img(32, 32, (x, y) => ((x + y) % 2 ? 255 : 0));
    const flat = img(32, 32, () => 128);
    expect(blurScore(sharp, 32, 32)).toBeGreaterThan(blurScore(flat, 32, 32));
    expect(blurScore(flat, 32, 32)).toBe(0);
  });
});

describe('assess', () => {
  it('flags dark, bright and blurry; passes a good image', () => {
    expect(assess(img(32, 32, () => 10), 32, 32).reason).toBe('dark');
    expect(assess(img(32, 32, () => 255), 32, 32).reason).toBe('bright');
    expect(assess(img(32, 32, (x) => 100 + (x % 2)), 32, 32).reason).toBe('blurry');
    expect(assess(img(32, 32, (x, y) => ((x + y) % 2 ? 200 : 60)), 32, 32)).toEqual({ ok: true, reason: null });
  });
});

describe('brightness', () => {
  it('is the mean', () => expect(brightness(new Uint8ClampedArray([0, 100, 200]))).toBe(100));
});

describe('receiptBox', () => {
  it('finds the bright block on a dark background', () => {
    const g = img(40, 40, (x, y) => (x >= 10 && x < 30 && y >= 5 && y < 35 ? 230 : 20));
    expect(receiptBox(g, 40, 40)).toEqual({ x: 10, y: 5, w: 20, h: 30 });
  });
  it('uniform image falls back to the full frame', () => {
    expect(receiptBox(img(10, 10, () => 100), 10, 10)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });
});
```

- [ ] **Step 2: Run to verify failure**, `npx vitest run src/brain/scan`. Expected FAIL.

- [ ] **Step 3: Implement `src/brain/scan/quality.ts`**

```ts
export const BLUR_MIN = 60;
export const DARK_MAX = 45;
export const BRIGHT_MIN = 245;

export function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const g = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return g;
}

export const brightness = (g: Uint8ClampedArray) => g.reduce((a, b) => a + b, 0) / (g.length || 1);

/** Variance of the 4-neighbour Laplacian. Higher is sharper. */
export function blurScore(g: Uint8ClampedArray, w: number, h: number): number {
  const vals: number[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      vals.push(g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]);
    }
  const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  return vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1);
}

export function assess(g: Uint8ClampedArray, w: number, h: number) {
  const b = brightness(g);
  if (b < DARK_MAX) return { ok: false, reason: 'dark' as const };
  if (b > BRIGHT_MIN) return { ok: false, reason: 'bright' as const };
  if (blurScore(g, w, h) < BLUR_MIN) return { ok: false, reason: 'blurry' as const };
  return { ok: true, reason: null };
}

// ponytail: bounding box of "bright" pixels, not true perspective correction. Upgrade to a document-scanner lib if samples fail.
export function receiptBox(g: Uint8ClampedArray, w: number, h: number) {
  const mean = brightness(g);
  const std = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / (g.length || 1));
  if (std < 5) return { x: 0, y: 0, w, h };
  const t = mean + 0.5 * std;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (g[y * w + x] > t) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
```

- [ ] **Step 4: Run to verify pass**, `npx vitest run src/brain/scan`. Expected PASS.

- [ ] **Step 5: Create `src/app/c/[token]/scan.ts` (browser wrapper)**

```ts
import { assess, receiptBox, toGray } from '@/brain/scan/quality';

const SMALL = 320;

export async function checkAndCrop(file: File, maxSide = 1600): Promise<{ blob: Blob; ok: boolean; reason: string | null }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, SMALL / Math.max(bmp.width, bmp.height));
  const sw = Math.round(bmp.width * k), sh = Math.round(bmp.height * k);
  const small = document.createElement('canvas');
  small.width = sw; small.height = sh;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(bmp, 0, 0, sw, sh);
  const gray = toGray(sctx.getImageData(0, 0, sw, sh).data);
  const verdict = assess(gray, sw, sh);

  // crop only when the box is a meaningful but not tiny part of the frame (avoid cropping to a bright logo)
  const box = receiptBox(gray, sw, sh);
  const area = (box.w * box.h) / (sw * sh);
  const crop = area > 0.25 && area < 0.95 ? { x: box.x / k, y: box.y / k, w: box.w / k, h: box.h / k } : { x: 0, y: 0, w: bmp.width, h: bmp.height };
  const out = Math.min(1, maxSide / Math.max(crop.w, crop.h));
  const c = document.createElement('canvas');
  c.width = Math.round(crop.w * out); c.height = Math.round(crop.h * out);
  c.getContext('2d')!.drawImage(bmp, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.85));
  return { blob, ok: verdict.ok, reason: verdict.reason };
}
```

- [ ] **Step 6: Use it in `Uploader.tsx`**

Replace the local `downscale` function with `import { checkAndCrop } from './scan';`. In `onPick`, replace the loop with:
```tsx
const form = new FormData();
for (const f of Array.from(files)) {
  const r = await checkAndCrop(f);
  if (!r.ok) { setState('retake'); if (input.current) input.current.value = ''; return; }
  form.append('file', r.blob, 'receipt.jpg');
}
```
Extend the state type with `'retake'`, accept a `retake` label prop (pass `t(lang, 'retake')` from `page.tsx`), and render `{state === 'retake' && <p className="text-amber-700">{labels.retake}</p>}`.

- [ ] **Step 7: Verify on a real phone**

Take a deliberately blurry photo, a very dark one, and a good one.
Expected: first two show the retake message and upload nothing; the good one uploads. If good photos are rejected on the low-end phone, lower `BLUR_MIN` in `quality.ts` and rerun the test (update the test inputs accordingly).

- [ ] **Step 8: Commit**

```bash
git add src && git commit -m "feat: client-side capture assist (blur, brightness, crop)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Smart scan B, batch and multi-receipt (client side)

**Files:**
- Create: `src/brain/scan/regions.ts`
- Modify: `src/app/c/[token]/scan.ts`, `src/app/c/[token]/Uploader.tsx`
- Test: `src/brain/scan/regions.test.ts`

**Interfaces:**
- Produces:
  - `findRegions(gray:Uint8ClampedArray, w:number, h:number, minArea?:number): {x:number;y:number;w:number;h:number}[]` connected components of "bright" pixels (threshold = mean + 0.5*std) with area ≥ `minArea` (default 8% of frame), sorted top-to-bottom then left-to-right, max 6.
  - `splitReceipts(file:File): Promise<Blob[]>` in `scan.ts` (returns one blob per detected region when 2 to 6 regions are found, otherwise the single cropped image).

- [ ] **Step 1: Write failing tests `src/brain/scan/regions.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { findRegions } from './regions';

const img = (w: number, h: number, rects: [number, number, number, number][]) => {
  const a = new Uint8ClampedArray(w * h).fill(20);
  for (const [x0, y0, rw, rh] of rects) for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) a[y * w + x] = 230;
  return a;
};

describe('findRegions', () => {
  it('finds two separate receipts, left to right', () => {
    const r = findRegions(img(100, 60, [[5, 5, 30, 50], [60, 5, 30, 50]]), 100, 60);
    expect(r).toEqual([{ x: 5, y: 5, w: 30, h: 50 }, { x: 60, y: 5, w: 30, h: 50 }]);
  });
  it('one receipt gives one region', () => {
    expect(findRegions(img(100, 60, [[20, 5, 50, 50]]), 100, 60)).toHaveLength(1);
  });
  it('ignores specks below the minimum area', () => {
    expect(findRegions(img(100, 60, [[20, 5, 50, 50], [2, 2, 3, 3]]), 100, 60)).toHaveLength(1);
  });
  it('uniform image returns no regions', () => {
    expect(findRegions(new Uint8ClampedArray(100 * 60).fill(100), 100, 60)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**, `npx vitest run src/brain/scan/regions.test.ts`. Expected FAIL.

- [ ] **Step 3: Implement `src/brain/scan/regions.ts`**

```ts
// ponytail: connected components on a brightness threshold. Touching receipts merge into one region; upgrade to a document-scanner lib if samples fail.
export function findRegions(g: Uint8ClampedArray, w: number, h: number, minArea = 0.08 * w * h) {
  const n = g.length;
  const mean = g.reduce((a, b) => a + b, 0) / (n || 1);
  const std = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / (n || 1));
  if (std < 5) return [];
  const t = mean + 0.5 * std;
  const seen = new Uint8Array(n);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let s = 0; s < n; s++) {
    if (seen[s] || g[s] <= t) continue;
    const stack = [s];
    seen[s] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i - x) / w;
      area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if (j >= 0 && !seen[j] && g[j] > t) { seen[j] = 1; stack.push(j); }
    }
    if (area >= minArea) out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 6);
}
```
The test expects left-to-right for receipts at the same `y`, which the `a.y - b.y || a.x - b.x` sort gives.

- [ ] **Step 4: Run to verify pass**, `npx vitest run src/brain/scan`. Expected PASS.

- [ ] **Step 5: Add `splitReceipts` to `scan.ts`**

```ts
import { findRegions } from '@/brain/scan/regions';

export async function splitReceipts(file: File, maxSide = 1600): Promise<Blob[]> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
  const sw = Math.round(bmp.width * k), sh = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, sw, sh);
  const regions = findRegions(toGray(ctx.getImageData(0, 0, sw, sh).data), sw, sh);
  if (regions.length < 2) return [(await checkAndCrop(file, maxSide)).blob];
  return Promise.all(
    regions.map((r) => {
      const box = { x: r.x / k, y: r.y / k, w: r.w / k, h: r.h / k };
      const out = Math.min(1, maxSide / Math.max(box.w, box.h));
      const cv = document.createElement('canvas');
      cv.width = Math.round(box.w * out); cv.height = Math.round(box.h * out);
      cv.getContext('2d')!.drawImage(bmp, box.x, box.y, box.w, box.h, 0, 0, cv.width, cv.height);
      return new Promise<Blob>((res) => cv.toBlob((b) => res(b!), 'image/jpeg', 0.85));
    }),
  );
}
```

- [ ] **Step 6: Wire into `Uploader.tsx`**

Allow `multiple` on the file input and keep the capture assist per file; after the quality check passes, use `splitReceipts(f)` instead of `r.blob` and append every returned blob. Show the count to the client: after upload success set `count` state from the response JSON and render `{count > 1 && <p>{count} إيصالات</p>}`. The upload route already groups multi-file posts with one `batch_id`, so siblings are linked.

- [ ] **Step 7: Verify**

Photograph two printed samples side by side on a dark table; then one receipt alone; then two separate photos via "add another".
Expected: two receipts in one photo become two `documents` with the same `batch_id`; a single receipt stays one; separate photos become separate documents. If regions merge or split wrongly on real photos, record it in `docs/notes/extraction-score.md` and leave single-receipt behaviour as is (the safe default).

- [ ] **Step 8: Commit**

```bash
git add src && git commit -m "feat: client-side multi-receipt split and batch upload" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Deploy, README, demo rehearsal

**Files:**
- Create: `README.md`, `public/qr/` (generated)
- Modify: `.gitignore` (confirm `.env*`, `samples/photos/`)

**Interfaces:**
- Produces: public Vercel URL; seeded Supabase project; printable QR cards per client; README a judge can follow in under 5 minutes.

- [ ] **Step 1: Deploy**

Push the repo to GitHub. In Vercel: import the project, set every variable from `.env.example` (plus `NEXT_PUBLIC_*` pair), set `maxDuration` is already per-route. Deploy.
Run `npm run seed` once against the production Supabase (use production env in `.env`); it also creates the demo accountant. In Supabase Auth settings set the Site URL to the Vercel URL and keep "Confirm email" OFF for the demo.
Expected: `https://<app>.vercel.app/board` shows the five seeded clients with the five stories.

- [ ] **Step 2: QR cards**

For each token printed by seed, generate a QR for `https://<app>.vercel.app/c/<token>` (use any QR generator, for example `npx qrcode "<url>" -o qr-mona.png`), print the Mona card with the client name. Keep the PNGs out of git (`public/qr/` in `.gitignore`) if they contain production tokens.

- [ ] **Step 3: Write `README.md`**

Contents (plain, short): what Qaid is in two lines; "Try it in 5 minutes" (open the app, tap "ادخل كأحمد" on `/login` for the demo accountant, scan the Mona QR or open its link, photograph a printed sample from `samples/`, watch it appear, confirm, ask the chat two demo questions, download the pack); architecture in one paragraph with the diagram image if exported; honest limits (does not file with the tax authority, no bank or WhatsApp, printed receipts only, rates marked "to verify", demo data invented); how to run locally (`.env.local`, `supabase` migration, `npm run seed`, `npm run dev`, `npm test`); where the brain lives (`src/brain/`, no framework imports, movable to another platform).

- [ ] **Step 4: Re-verify the rates**

Check VAT 14%, social insurance 18.75% / 11% with bounds 2,700 to 16,700, minimum wage 7,000, VAT threshold 250,000 against current official sources. Update `src/brain/config.ts` if anything changed and keep the `// to verify` comments only on values still unconfirmed. Re-run `npm test`.
Expected: all tests pass.

- [ ] **Step 5: Full rehearsal on a real phone**

Follow the idea.md demo story end to end, timing it:
1. Board shows the five seeded stories: three `strange` (Mona price jump, Accessories duplicate, Workshop VAT), one `missing` (Cafe rent), one `silent` (Instagram seller). The idea.md demo shows "two complete"; to match it, confirm or close the flags on two clients before recording.
2. Scan the QR with a phone, photograph a printed sample: appears on the board within seconds, confirm it.
3. Chat: "Who hasn't sent documents this month?" then click draft reminder.
4. Chat: "Why did Mona's margin drop?"
5. Download Mona's Excel and PDF.
Expected: every step works on cellular data; total under 3 minutes. Fix anything that does not before recording the demo video.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: README, deploy notes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage**
- Decisions table (Next.js, Vercel, Supabase, jobs, Parse + GPT-6, export): Tasks 1, 6, 7, 8, 16, 19.
- Structure and `brain/` boundary: File Structure; enforced by Global Constraints.
- Data model incl. `chat_messages`: Task 6 (table exists; chat does not persist threads yet, deviation below).
- Upload pipeline (4): Tasks 9, 10, 8.
- Fusion (4a): Tasks 3, 7.
- Smart scan A and B (5): Tasks 17, 18. Server-side `documents[]` net: listed as a deviation.
- Board, chaser, chat, month-end, export (6): Tasks 11, 13, 15, 16.
- Demo data and samples (7): Task 14.
- Build order (8), testing (9), out of scope (10), open items (11): Tasks order matches priorities; open items (accountant fee, Wesam.ai, rates) carried to Task 19 Step 4 and README.
- Gaps found and handled: chat thread persistence (`chat_messages` table is unused). Decision: persistence is a stretch; the chat keeps history in the browser for the session. Add to deviations if kept.

**Placeholder scan:** Task 7 Step 4 deliberately defers the exact Parse request body to `docs/notes/parse-api.md` because the Foundry endpoint shape could not be verified from here; the function and its test boundary are fixed and only the two marked lines change. No other TBD/TODO.

**Type consistency:** `Extracted`, `Fused`, `Entry`, `Flag`, `Llm`, `Msg`, `ToolDef`, `Handlers`, `Job`, `JobStore`, `PackInput`, `BoardRow` are defined once and used with the same names and signatures later. `mapEntry` (Task 11) is reused by Tasks 15 and 16. `supabaseRepo.entriesForClient` (Task 10) returns `imageHash`; `Entry.imageHash` is optional in Task 2. Excel cell addresses (`P&L!B4`, `VAT!B4`) match the row layout described in Task 16.
