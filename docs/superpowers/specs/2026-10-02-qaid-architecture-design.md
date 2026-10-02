# Qaid architecture design

Date: 2026-10-02. Source of intent: `idea.md`. Rule above all: **Qaid prepares, the accountant decides.** Every number comes from deterministic code on real records, never from model output.

## 1. Decisions

| Area | Choice |
|---|---|
| App | Single Next.js (TypeScript) app, backend inside it (route handlers, server code) |
| Hosting | Vercel |
| Data | Supabase: Postgres, Storage (private bucket), Realtime |
| Auth | Supabase Auth, email + password, accountants only (clients keep token links, no login). Each user belongs to an office via `office_members`. A visible demo account (Ahmed) lets judges in with one tap. |
| Jobs | `jobs` table in Postgres, run by `after()`, retried by Vercel Cron sweep |
| Document reading | Azure AI Foundry: Cohere Parse v5 (image to Markdown + bounding boxes), then GPT-6 structured output (Markdown to JSON) |
| Extraction, categorising, chat, drafting | GPT-6 family on Foundry (gpt-6-astra, gpt-6-luna, gpt-6-sol, gpt-6.1-sol; all support structured outputs). Model name per job in one config file. Cost is not a constraint (user decision): gpt-6-astra for every job. Set low reasoning effort on extraction for demo latency. Variant names deployed in the user's Foundry project are unverified, pin them in config at setup. |
| Export | PDF (react-pdf) and Excel (exceljs) |
| Language | Arabic RTL native, English supported, EGP only |

Parser decision: **fusion**. Cohere Parse v5 and GPT-6 vision both read every receipt, in parallel, and `brain/extract/fuse` reconciles them with plain code (section 4a). Unverified: no public benchmark covers Arabic phone-photo receipts for either reader. Day-1 check on the ten sample receipts scoring each lane alone and fused (vendor, date, total, VAT). If one lane is useless, config turns fusion off and the other lane runs alone. Other parsers (Mistral Document AI, Azure Document Intelligence, jina-ocr-v1) only if both fail. Jev (TypeSafe) skipped for now; categorisation sits behind a `categorise()` interface so it can be added later.

## 2. Structure

```
src/
  app/
    c/[token]/          client phone page
    (accountant)/       board, client detail, review, chat, month-end
    api/upload, api/jobs/run, api/jobs/sweep, api/export/*
  server/               only place touching Supabase and Foundry keys; auth, DB, jobs
  brain/                pure TS, no Next/Supabase imports
    extract/  scan/  ledger/  checks/  ask/  draft/
```

Boundary rule: `brain/` takes plain data in, returns plain data out. Moving it to Wesam.ai later means wrapping it in an endpoint.

## 3. Data model

`offices`, `office_members` (user to office), `clients` (upload `token`), `documents` (image path, image hash, status), `entries` (vendor, date, amount, VAT, category, document link, confirmed), `expected_docs`, `flags`, `jobs`, `chat_threads`, `chat_messages`. Every row carries `client_id` (and office); data never mixes.

Document status: `received`, `extracting`, `needs_review`, `confirmed`, `failed`.

## 4. Upload to board pipeline

1. Client opens `/c/[token]`, captures photo(s). Smart scan runs in browser (section 5), image downscaled to about 1600px JPEG.
2. `POST /api/upload`: validate token, store image, insert `documents` and `jobs` rows, return "got it" at once.
3. `after()` runs job: `extracting`, fusion extraction (section 4a), deterministic validation (total = subtotal + VAT, VAT near 14% *to verify*, date parses, amount positive), write `entries`, status `needs_review`. Mismatch or low confidence creates a `flag`; nothing is silently fixed.
4. Checks run per entry: duplicate (vendor+amount+date or image hash), price jump vs vendor history, VAT spike vs client history.
5. Board subscribes to Realtime. Row appears as `received`, fills in seconds later.
6. OpenAI proposes category from fixed list (rent, supplies, sales, salaries, utilities, other). If unsure, one short question to the accountant. Accountant bulk-confirms. Only confirmed entries count.

Failures: 3 retries via cron sweep, then `failed` with a retry button. Unreadable photo: client still sees "got it"; accountant sees "could not read, ask client to resend".

Security: token is unguessable and upload-only; keys server-side; private bucket with signed URLs. Accountant pages and APIs require a Supabase Auth session; every server query is scoped by the caller's office (never trust ids from the browser); Postgres RLS restricts reads to the user's office so Realtime only streams their own rows. Writes go through server code with the service key after an ownership check. Email confirmation is off for the demo so judges can sign up instantly (turn on before real use).

## 4a. Fusion extraction

Two independent lanes run in parallel on the same image (latency = slower lane, cost about 2x per receipt):
- **Lane A:** Parse v5 (image to Markdown + boxes), then GPT-6 text call with JSON schema (vendor, date, subtotal, VAT, total, doc type, line items).
- **Lane B:** GPT-6 vision on the raw image, same JSON schema.

`fuse()` is deterministic code, no model, per field:
1. Both lanes agree: accept, confidence high.
2. They differ: prefer the candidate that passes arithmetic (total = subtotal + VAT, VAT near 14%). If both or neither pass, keep both candidates and raise a `flag`; accountant sees the two values and the image side by side and picks.
3. Anti-hallucination check: every amount and date in the result must appear as a literal string in Parse v5's Markdown (after Arabic-Indic digit normalisation). An amount GPT-6 vision "sees" that Parse never read gets lowered confidence.
4. One lane errors or times out: run on the other lane alone, mark confidence medium, never block the upload.

Output: one `entries` row plus per-field `agreement` (agree, resolved, disputed) so the board can show why something needs review. Only `disputed` fields demand attention, which keeps review fast.

Cost is not a constraint (user decision), so both lanes always run. Fusion off per config uses a single lane. Unit tests cover `fuse()` with fixed JSON pairs (agree, differ, one lane missing, digit normalisation).

## 5. Smart scan (all vision detection runs client-side)

Rule: detection, cropping and splitting happen in the browser before upload. The server only reads text (Parse v5, then OpenAI). Benefits: no AI cost for detection, bad photos caught before they cost an upload on a slow connection, smaller uploads. Code lives in `src/app/c/[token]/scan/` (client only, no server imports).

Cost to manage: a document-scanner library (OpenCV.js based, for example jscanify; to evaluate) is large for cheap phones. Lazy-load it only after the first photo is taken, and keep the plain heuristics below as the fallback if it fails to load or is slow. Test on a low-end phone.

**A. Capture assist (client side, no AI cost).** After capture, in-browser canvas checks on a downscaled copy: blur (variance of Laplacian), brightness. If bad: "too blurry / too dark, retake". Best-effort auto-crop to the receipt's bounding region on the downscaled image. No heavy CV library (slow phones). *Ceiling:* simple heuristics, not true perspective correction; upgrade path is a lightweight edge-detection lib if samples show need.

**B. Batch and multi-receipt.**
- Multi-photo: "add another" before sending; each photo becomes its own `documents` row.
- Multi-receipt in one photo: the browser detects each receipt region, shows the client "found 3 receipts", crops each, and uploads them as separate documents linked by a shared `batch_id`. Accountant sees them as siblings in review.
- Server-side safety net: `extract()` schema still returns `documents[]` and Parse v5 bounding boxes are used if a single uploaded image turns out to hold several receipts the client missed.

## 6. Board, chaser, chat, export

**Board status** is computed per client by query, never hand-set. Display priority: strange, missing, silent, review, ready. Every count links to the documents behind it.
- `silent`: no uploads this month though pattern expects some.
- `missing`: an `expected_docs` item (rent, main supplier, payroll) has no matching entry. Demo: seeded. Rule is SQL, no AI.
- `strange`: open flags.
- `review`: entries in `needs_review`.

**Chaser.** For `missing` or `silent`, OpenAI writes a polite Egyptian-Arabic message from the exact missing list (from SQL). Model writes wording only. Accountant copies or sends; Qaid never sends and never claims to.

**Agent chat.** Chat panel on the board, one persistent thread per office, streaming. Tool-calling loop over deterministic code: `clients_without_uploads(month)`, `margin_change(client, month)`, `vat_by_client(month)`, `top_price_changes(client)`, plus action tool `draft_reminder(client)` which places the draft in chat. Rules: every answer states client and month; empty tool result gives "I don't have enough information"; answers cite the entries behind them; chat never files, sends, or confirms anything.

**Month-end pack.** `ledger/` computes P&L, VAT summary (output minus input), payroll sheet with social insurance. Rates and bounds live in one config file marked *to verify*: VAT 14%, employer 18.75%, employee 11%, wage bounds EGP 2,700 to 16,700, minimum wage 7,000.
- PDF, stamped "prepared for accountant review".
- Excel (`.xlsx`) per client and month: sheets Entries (one row per قيد), P&L, VAT, Payroll. Formulas for totals so the accountant can audit. Confirmed entries only.

## 7. Demo data

Seed script: 5 invented clients, 3 months each, built-in stories (Mona price jump, café missing rent, accessories duplicate invoice, workshop high VAT, Instagram seller silent). Banner marks all data invented. Ten printed samples in `/samples`. No real customer data in the repo.

## 8. Build order (from idea.md section 13, with additions slotted)

1. Upload and live board row (plus smart scan A, small).
2. Extraction to filed data (Parse + OpenAI), `extract()` fallback decision.
3. Bulk review and confirm (plus smart scan B).
4. Client board with computed statuses.
5. Chaser.
6. Agent chat.
7. Month-end pack: PDF and Excel.
8. Stretch: read-only client view.

Steps 1 to 5 working flawlessly beats all eight half-working. Smart scan B and Excel are first to cut if time runs short.

## 9. Testing

- Unit tests on `brain/ledger` and `brain/checks` (pure, cheap, numbers must be right). Include one test that Excel totals equal ledger totals.
- One manual extraction run on the ten samples against Foundry.
- One manual phone end-to-end run before the demo.

## 10. Out of scope

Tax authority submission, banks and wallets, WhatsApp, salary income tax, handwriting, non-EGP currency.

## 11. Open items

- Real monthly fee per client in Egypt (needed for slides, ask a real accountant).
- Whether the winning agent must run on Wesam.ai (brain boundary keeps this cheap).
- Re-verify all rates in section 6 before the demo.
