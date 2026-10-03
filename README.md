<p align="center"><img src="public/logo-mark.svg" width="96" alt="Qaid logo: the Arabic letter qaf"></p>

# Qaid (قيد)

**Qaid prepares the books. The accountant decides.**

Small Egyptian businesses send their receipts as phone photos. Qaid reads them with two AI readers, cross-checks the result, flags anything strange, and prepares the month for the accountant, who only has to review and confirm. Every number comes from deterministic code on stored records, never from a model's guess.

Built for a hackathon (build window 1 to 3 October 2026). Demo data is invented.

## Try it in 5 minutes

1. Run it locally (see [Run it locally](#run-it-locally)), then open `/login`.
2. Press **Enter as Ahmed**. An auto-playing tour drives the real app for about two minutes: a client sends a receipt from a phone, the board fills in, Ahmed confirms it, an Arabic reminder is drafted, the chat answers a question, and the month-end pack is shown. Pause or skip it any time.
3. When the tour ends, the account is yours with the seeded data:
   - **Phone scan** (board header or any client page) opens the client's phone page in a phone frame, plus a QR code for a real phone. Send a receipt photo and watch the board.
   - Open a client, check the numbers beside the receipt, edit, and **Confirm**.
   - **Ask Qaid** is a chat over the office's books.
   - **Excel** and **PDF** on a client page give the month-end pack.
   - **Replay tour** and the **العربية** toggle are in the board header.

The tour cleans up after itself, so the seeded data is untouched when it ends.

## What it does

| Who | What |
|---|---|
| Client (shop owner, phone) | Opens a private link, no account, taps one button, photographs a receipt. The phone checks blur and light, crops, and can split several receipts in one photo. |
| Qaid | Reads each receipt with two lanes (Cohere Parse v5 and GPT-6 vision) and fuses them, runs checks (duplicate, supplier price jump, VAT spike), proposes a category, and keeps a live board. |
| Accountant | Sees every client on a ledger board with a status, reviews entries next to the source receipt, bulk-confirms, asks the chat questions, drafts Arabic reminders for missing documents, and downloads the month-end pack. |

Status of a client, in priority order: **Needs you** (open flag), **Documents missing**, **Gone quiet** (no uploads), **Awaiting review**, **Clear**. Only confirmed entries count in any total.

## How it works

```
 phone page /c/<token>              accountant app (Supabase Auth)
   capture + check + crop             board, review, chat, pack
          |                                    |
          v                                    v
   POST /api/upload  ---->  Postgres (Supabase)  <----  server actions, /api/chat, /api/export
          |                 documents, entries, flags,
          v                 jobs, expected_docs, ...
   jobs table (queue) --> process_document:
                           lane A: Cohere Parse v5 -> markdown -> GPT-6 structure
                           lane B: GPT-6 vision
                           fuse() reconciles both, nothing is silently fixed
                           -> checks -> category -> entry + flags -> needs_review
```

- **App:** one Next.js 16 app (App Router, Turbopack, `src/proxy.ts` for route protection), Tailwind 4, TypeScript.
- **Data:** Supabase Postgres with row-level security (an office only sees its own clients), a private `receipts` Storage bucket, and Supabase Auth for accountants. Clients use unguessable upload tokens, upload-only.
- **Jobs:** a `jobs` table with `claim_job()` (`for update skip locked`), retries and a dead state. Uploads run `after()` with in-request retries; `GET /api/jobs/sweep` (called by `pg_cron` in production) is the backstop.
- **AI:** Azure AI Foundry, one resource and key. `gpt-6.1-sol` extracts and categorises, `gpt-6-astra` chats and drafts, `cohere-parse-v5` parses. The model router in `src/server/models.ts` is the only file that knows model names and hosts.
- **Chat:** an `@openai/agents` agent with tools over the office's data (`list_clients`, `client_overview`, `open_flags`, `month_summary`, `margin_change`, `vat_by_client`, `top_price_changes`, `recent_entries`, `clients_without_uploads`, `draft_reminder`). Every figure comes from a tool. Answers stream.
- **The brain:** `src/brain/` is pure TypeScript with no Next or Supabase imports: ledger math (P&L, VAT, payroll, price changes), fusion, checks, client status, scan quality, reminder prompt, and the Excel/PDF builders. It can be lifted into another platform by wrapping it in an endpoint.

## Project structure

```
src/
  app/            routes: /login, /board, /board/[clientId], /chat, /c/[token], /api/*
  brain/          pure logic (ledger, extract/fuse, checks, scan, draft, export, status)
  server/         everything that touches Supabase, Foundry or auth (jobs, pipeline, tools, actions)
  components/     Flaps, Guilloche, Logo, PhonePanel, LangToggle, tour/
  i18n/           one dictionary (en, ar), cookie-based language
  proxy.ts        route protection
supabase/
  migrations/     schema, RLS, claim_job, storage bucket
  deploy/         schedule-sweep.sql (pg_cron template, run once at deploy)
scripts/          seed.ts, score-extraction.ts, smoke-ai.ts
samples/          ten invented receipts + ground truth for the extraction scorer
docs/             spec, implementation plan, design language sheet, pricing notes
```

## Design and language

The look is **banknote engraving**: issuing green, gold foil, note stock, guilloche linework, split-flap counters, and a foil seal on confirmed entries. The logo is the Arabic letter ق (the Q of قيد). Red is used only for flags. Reference sheet: [`docs/design/language-sheet.html`](docs/design/language-sheet.html).

English is the default (LTR). Arabic is an opt-in toggle (RTL) stored in a cookie; every string comes from `src/i18n/dictionary.ts`.

## Run it locally

Prerequisites: Node 22+, a Supabase project, and an Azure AI Foundry resource with the three models deployed.

```bash
npm install
cp .env.example .env.local     # fill in the values below
```

| Variable | What |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access (never exposed to the browser) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and auth |
| `FOUNDRY_RESOURCE`, `FOUNDRY_API_KEY` | One Foundry resource serves GPT-6 and Cohere Parse |
| `MODEL_EXTRACT`, `MODEL_CHAT`, `MODEL_PARSE` | Optional model overrides |
| `FUSION` | `on` runs both reader lanes, `off` runs Parse only |
| `CRON_SECRET` | Bearer secret for `GET /api/jobs/sweep` |

Database: apply `supabase/migrations/0001_init.sql` then `0002_lock_server_tables.sql` (SQL editor or the Supabase CLI). In Supabase Auth settings turn **Confirm email** off for the demo.

```bash
npm run seed     # creates the demo office, five clients with built-in stories, and ahmed@demo.qaid.app
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
```

`npm run seed` wipes and recreates only the demo user and demo office, each by id. Run it again any time to reset the demo.

| Script | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest |
| `npm run seed` | Reset and seed the demo office |
| `npm run score` | Score extraction on `samples/photos/*.jpg` against `samples/ground-truth.json` (see `samples/README.md`) |
| `npm run smoke:ai` | Smoke test of the two reader lanes on one image |
| `npm run lint` | ESLint |

## Deploy

1. Import the repo into Vercel and set every variable above.
2. In Supabase Auth, set the Site URL to the deployed URL.
3. Run `npm run seed` once against the production project.
4. Run `supabase/deploy/schedule-sweep.sql` once in the SQL editor with the real app URL and `CRON_SECRET` filled in. It schedules the retry sweep every minute. Do not commit real values.

Phone cameras need HTTPS, which Vercel provides.

## Honest limits

- Qaid **prepares only**. It does not file with the tax authority, talk to banks, or send WhatsApp messages. Reminders are drafts the accountant copies.
- The VAT rate, social insurance rates and bounds, minimum wage and VAT threshold in `src/brain/config.ts` are **marked "to verify"** and have not been confirmed against official sources.
- Printed receipts only. Hand-written notes, statements and handwritten amounts are out of scope. Currency is EGP only.
- No public benchmark covers Arabic phone-photo receipts, so extraction accuracy is measured with `npm run score` on your own photos.
- The PDF pack uses the English client name because Arabic shaping in the PDF renderer is unverified. The Excel pack uses the Arabic name.
- Supabase Realtime did not deliver events for the row-level-secured tables during testing, so the board also refreshes itself every four seconds while the tab is visible.
- Sign-up says when an email is already registered. This is a deliberate demo trade-off (it reveals that an account exists); make it generic before real client data goes in.
- The Egyptian fee per client is unknown, so the pricing notes in `docs/notes/pricing-and-impact.md` are estimates.

## Docs

- Architecture spec: [`docs/superpowers/specs/2026-10-02-qaid-architecture-design.md`](docs/superpowers/specs/2026-10-02-qaid-architecture-design.md)
- Implementation plan and amendments: [`docs/superpowers/plans/2026-10-02-qaid-implementation.md`](docs/superpowers/plans/2026-10-02-qaid-implementation.md)
- Cohere Parse request shapes: [`docs/notes/parse-api.md`](docs/notes/parse-api.md)
- Pricing and impact estimates: [`docs/notes/pricing-and-impact.md`](docs/notes/pricing-and-impact.md)
