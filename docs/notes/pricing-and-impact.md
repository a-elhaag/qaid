# Pricing and impact considerations (for the slides)

Status: estimates. Every figure is labelled; nothing here is a confirmed Egyptian office number unless stated. Open items at the bottom.

## Verified prices (Egypt, EGP)
- Wafeq Starter: 805/month. Plus: 1,155/month. Premium: 1,991/month. ([Wafeq Egypt pricing](https://www.wafeq.com/en-eg/pricing))
- Those are per business. Anchor: one business on Premium costs about EGP 1,991/month.
- Accountant pay (Glassdoor, 50 reports): median EGP 6,000/month, range 4,000 to 12,000. ([Glassdoor Egypt accountant salaries](https://www.glassdoor.com/Salaries/egypt-accountant-salary-SRCH_IL.0,5_IN69_KO6,16.htm))
- Egyptian fee per client: not found. Search returned only UAE and US pages. [Unverified]

## Math (code-run, re-checked)
- Setup: 25 clients x 5 h = 125 productive hours per bookkeeper (US-sourced, unverified for Egypt).
- Break-even client fee, with n = clients after Qaid, p = Qaid price per client, e = extra clients:

  F_break-even = (n x p) / e

| Hours per client after Qaid | Clients | Extra clients |
|---|---|---|
| 4.5 | 27.8 | 2.8 |
| 4.0 | 31.2 | 6.2 |
| 3.5 | 35.7 | 10.7 |

- At 4.0 h and p = EGP 50: Qaid costs EGP 1,562/month and breaks even at F = EGP 250 per client.
- At 4.0 h and p = EGP 100: breaks even at F = EGP 500.
- At 4.0 h and p = EGP 50, an INVENTED fee of EGP 1,000 gives net +EGP 4,688/month per bookkeeper.

## What this means for pricing
- Pure cost saving is small. A bookkeeper at EGP 6,000 costs about EGP 37.5/hour (assuming 160 h/month), so one hour saved per client is worth about EGP 37.5.
- Sell revenue, not cost. Slide: more clients per bookkeeper.
- Price at EGP 50 per client per month. A 31-client office pays about EGP 1,562, below one Wafeq Premium seat.
- Slide placeholder: "At EGP [real fee] per client, +6 clients is EGP [6 x fee] per month."

## Presentation gaps (open)
- Real fee per client: ask one accountant. Needed to turn "more clients" into revenue.
- Real hours per client: same call.
- Fee figures of 500, 1,000, 1,500 are invented placeholders. Label them as such on any slide.

Next step: send the accountant these two questions, then fill the slide numbers.

## Egypt-adjusted estimates (method, not measured data)

Label every number below "estimate". Method: keep the US workload figures (hours per client are about the work, not the price level), but price the work in Egyptian terms using the verified Egyptian salary. No exchange rate is used, so nothing depends on an unverified FX figure.

Assumptions (all unverified, change them when real data arrives):
- Bookkeeper cost: EGP 6,000/month (Glassdoor median, verified), 160 working hours/month, so EGP 37.5/hour. Overhead (rent, insurance, tools) not added, so true cost is higher.
- Hours per client today: 5 (US figure). After Qaid: 4.0 (US-style estimate).
- Office pricing rule: fee = labor cost per client x markup. Markup of 2x to 3x is an ASSUMPTION about how small service offices price, not a sourced number.

Labor cost per client per month: 5 h x 37.5 = EGP 187.5. So the estimated fee band:

| Markup | Estimated fee per client (EGP/month) |
|---|---|
| 2.0x | 375 |
| 2.5x | 469 |
| 3.0x | 563 |

Impact per bookkeeper at 4.0 h per client (25 clients become 31.25, so +6.25 clients), net of Qaid's price per client p:

| Fee F | Extra revenue | Net at p = EGP 50 | Net at p = EGP 25 |
|---|---|---|---|
| 375 | 2,344 | +781 | +1,563 |
| 469 | 2,930 | +1,367 | +2,148 |
| 563 | 3,516 | +1,953 | +2,734 |

(Qaid cost: 31.25 clients x p = EGP 1,563 at p = 50, EGP 781 at p = 25.)

What this tells us:
- The earlier EGP 1,000 invented fee gave +4,688. Realistic Egyptian fees (this method) give roughly +800 to +2,000 per month per bookkeeper at EGP 50. Do not show 4,688 on a slide.
- Break-even needs only a 1.33x markup over labor at p = 50 (F = EGP 250), so the offer holds even at low fees. The gain is thin at p = 50 and healthier at p = 25.
- Recommendation: price at EGP 25 to 35 per client per month for launch, or sell a flat office plan, until a real fee per client is known.
- Slide wording: "Estimated, using Egyptian salary data and US workload data. At [real fee] per client, 6 extra clients adds [6 x fee] per month."

Still needed from one real accountant: actual fee per client, actual hours per client, and how offices decide their markup.
