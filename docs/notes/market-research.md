# Market research and measurements (for the deck and the demo)

Date of research: 2026-10-03. Every number is tagged **sourced**, **measured** (by us, in this repo) or **estimate** (our assumption). Nothing untagged goes on a slide.

## 1. The market (sourced)

| Fact | Source |
|---|---|
| Micro, small and medium enterprises are about 90% of Egypt's private sector, 43% of GDP and 75% of the workforce; EGP 1.2 trillion production value (MSMEDA CEO, Nov 2024) | [Ahram Online](https://english.ahram.org.eg/News/534900.aspx) |
| 3.4 million micro, 217,000 small and 2,200 medium businesses | [Daily News Egypt, 2023](https://www.dailynewsegypt.com/2023/03/19/small-enterprises-contribute-43-to-gdp-account-for-over-75-of-employment-msmeda/) (search summary; the exact paragraph was not re-opened, re-check before quoting) |
| 97% of businesses have fewer than 10 workers | same search; same caveat |
| Law 6 of 2025 gives businesses under EGP 20m turnover a simplified tax regime (0.4% to 1.5% of turnover) and simplified record-keeping, conditional on ETA e-invoice and e-receipt compliance | [EY](https://www.ey.com/en_gl/technical/tax-alerts/egypt-introduces-tax-incentives-and-benefits-for-small-enterprises), [Andersen](https://eg.andersen.com/tax-incentives-for-smes-egypt-2026/) |
| E-invoice registration threshold lowered from EGP 500,000 to 250,000 annual revenue (Resolution 281 of 2025), registration due before 31 March 2026 | [ClearTax Egypt](https://www.cleartax.com/eg/en/e-invoicing-egypt) |
| B2C e-receipts: additional taxpayers from 15 Sept 2025 | [Comarch](https://www.comarch.com/trade-and-services/data-management/legal-regulation-changes/egypt-expands-e-receipt-requirements-for-b2c-transactions-from-september-2025/) |

## 2. Why the accountant stays (reasoning, label as such)

- The state is pushing every small business into ETA systems and filing deadlines. More compliance means more reason to keep an accountant, not less.
- E-invoice and e-receipt cover documents the business **issues** (sales). The **purchase** receipts from suppliers (the ones Qaid reads) are still paper or photos for most small suppliers. **Estimate / reasoning, not sourced**; say so on the slide.
- Law 6 2025 does not say whether an accountant is required (searches did not state it). Do not claim it does.
- So the buyer is the accounting office: it must process this paper for every client every month.

## 3. The accountant's workload (sourced, mostly UK/US)

- 56% of 250 UK accountants and bookkeepers said they spend too much time on manual tasks (Dext survey, 2023). [Accountex](https://www.accountex.co.uk/insight/2023/05/17/mundane-and-manual-dext-survey-reveals-nearly-60-of-accountants-spend-too-much-time-on-manual-tasks/)
- A simple client costs 4 to 6 hours a month of bookkeeping; categorising and coding is 2 to 3 hours of that. [Jetpack Workflow](https://jetpackworkflow.com/blog/how-many-hours-per-client-bookkeeping/) (US blog, not Egypt)
- Manual receipt entry: 3 to 5 minutes per receipt, 1 to 3% error rate. [DocuClipper](https://www.docuclipper.com/blog/receipt-data-entry/) (vendor blog, treat as indicative)
- Manual invoice entry error rate about 1 to 2% (APQC figure quoted in industry blogs). [Resolve](https://resolvepay.com/blog/13-statistics-that-quantify-cost-per-invoice-in-manual-vs-automated-flows)

**Gaps, not found:** number of accounting offices in Egypt (only ESAA membership of about 1,500 active members turned up, which is not the market); the fee an Egyptian office charges per small client; hours per client in Egypt. Ask one accountant. Placeholders are in `pricing-and-impact.md`.

## 4. Measured here (`npm run score`, 10 invented receipts)

Setup: the ten `samples/*.html` receipts rendered to JPG by headless Chrome. **These are clean renders, not phone photos**, so accuracy on real photos will be lower. Ten receipts is a tiny sample.

| Run | Result |
|---|---|
| Unpaced, fusion on | 10/10 on every field, median 3.9 s per receipt, max 7.0 s. **But** the Parse lane returned HTTP 429 for most receipts, so most were read by the vision lane alone. Do not present as fused accuracy. |
| Paced 20 s, fusion on | vendor 9/10, date, subtotal, VAT, total 10/10; median 4.8 s, max 9.0 s. Field agreement: 17 agree, 1 resolved, 2 disputed, 30 single-lane (6 of 10 receipts still lost the Parse lane). The one vendor miss was a missing letter in an Arabic name (flagged as `resolved`, not silent). |
| Fusion off | Fails: lane A alone threw 429, so "both lanes failed" (fuse has nothing to use). |

Finding to state honestly: the `cohere-parse-v5` deployment is rate limited (429 `RateLimitReached`, uaenorth). The pipeline degrades to a single lane and says so (`single`), it does not fail. A production deployment needs a higher Parse quota.

**Paced 60 s, fusion on (the fused result to quote):** vendor 9/10, date 9/10, subtotal 10/10, VAT 10/10, total 10/10 (48/50 fields). Median 6.5 s per receipt, max 8.0 s. Field agreement: 40 agree, 2 resolved, 3 disputed, 5 single-lane, so 45 of 50 fields were read by both lanes. The two misses were both marked `resolved` (the lanes disagreed and the code picked one), not caught as disputed:
- Receipt 06: date read as 2021-10-06, truth 2026-10-06.
- Receipt 07: Arabic vendor lost one letter.

Say this on the slide: the money fields (subtotal, VAT, total) were 30/30; the misses were a date digit and an Arabic name. Next fix to name: a `resolved` date or vendor should still be shown to the accountant for review.

## 5. Latency (measured)

- Vision lane alone: 2.9 to 4.3 s per receipt (3 samples). Parse lane alone: 5.9 s (1 sample, the rest were rate limited).
- Both lanes run in parallel, so the receipt time is roughly the slower lane (about 4 to 9 s), not the sum.
- Upload returns immediately; extraction runs after the response (`after()`), so the client waits for nothing.
