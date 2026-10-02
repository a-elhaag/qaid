# CLAUDE.md — Qaid (قيد)

Read this first. It is the idea, the people, and the reasoning behind Qaid. Pick the tech yourself. When a choice is unclear, go back to this file and ask which option helps the accountant and the client most.

## 1. The idea in one breath

Qaid is an AI assistant for small Egyptian accounting offices that look after dozens of tiny businesses. The shop owner takes a photo of a receipt on their phone. Qaid reads it, files it under the right client, and tells the accountant what needs a look. At month-end the accountant gets each client's numbers ready to review, instead of a plastic bag of paper.

"قيد" means a journal entry, the line an accountant writes for every transaction. Qaid writes those lines so the accountant doesn't have to.

Pitch line: **The owner never types. The accountant never chases receipts.**

## 2. Why this exists

A small accounting office in Egypt typically serves 20–60 small clients: shops, online sellers, workshops, cafés. Those clients keep their books in a notebook, a WhatsApp chat, or a shoebox. At month-end:

- Receipts show up late, blurry, or not at all.
- A junior accountant spends hours typing them into spreadsheets.
- The accountant spends more hours calling and messaging clients to ask "where is the rent receipt?"
- Mistakes (a duplicate invoice, a missing document) surface only at filing time, when it is stressful and expensive.

The pressure is growing. Egypt dropped the VAT registration threshold to EGP 250,000 in annual revenue, so many more small businesses now need proper books and e-invoicing. More clients, same number of accountants.

## 3. Who it is for

**The paying user: the accountant.**
Runs a small office, 1–5 people, 20–60 small clients. Their problem is capacity: there are only so many hours, and most go to chasing and typing. If Qaid gives them hours back, they can take on more clients and earn more.

**The uploading user: the client owner.**
A shop owner with no accounting software and no patience for any. They must be able to use Qaid with one thumb, in one tap, in a minute. If it needs training, it has failed.

**Demo characters (all made up):**
- Ahmed: runs a two-person accounting office in Nasr City with 30 clients.
- Mona: home-goods shop, three staff.
- A café, a phone-accessories shop, an aluminium workshop, and an Instagram clothing seller.

## 4. What Qaid does, in plain words

1. **Collects.** Every client gets their own simple link (and a printed QR card for the shop counter). They open it on their phone, snap the receipt, done. No app to install, no account to create.
2. **Reads.** Qaid understands printed Arabic and English receipts, supplier invoices, and payment screenshots, and pulls out who, when, how much, and how much tax.
3. **Files.** It decides where each document belongs (rent, supplies, sales, salaries…). When it is unsure it asks one short question instead of guessing.
4. **Shows the accountant everything in one place.** A board with every client and their status: documents received, waiting for review, something missing, something strange, ready for month-end.
5. **Chases.** It knows what each client normally sends (rent receipt, the main supplier, payroll). When something is missing it writes a polite message in Arabic listing exactly what is missing. The accountant sends it.
6. **Spots problems early.** A supplier raising prices, a document uploaded twice, VAT unusually high, a client who has gone silent.
7. **Answers questions.** The accountant can ask in plain Arabic or English: "Who hasn't sent anything this month?", "Why did Mona's margin drop?", "Which clients owe the most VAT?"
8. **Prepares the month-end pack** for each client: profit and loss, VAT summary, and a payroll sheet with social insurance. The accountant reviews and approves.

## 5. The one rule that keeps us honest

**Qaid prepares. The accountant decides.**

- Qaid never claims to replace the accountant.
- Qaid never claims to have filed, paid, or submitted anything with the tax authority.
- Every number comes from real calculations on real records, never from the AI's guess. If the data is not there, Qaid says "I don't have enough information."
- Every answer says which client and which month it is about. Clients' data never mixes.

## 6. What Qaid is not (do not build, do not fake in the demo)

- It does not submit to the Egyptian Tax Authority. That needs a government-issued signing token we don't have.
- It does not connect to banks or wallets, and it does not verify payments.
- It does not run on WhatsApp. The demo uses a simple phone web page.
- It does not do salary income tax; only social insurance.
- It does not read handwriting. Printed receipts and screenshots only.
- Everything is in Egyptian pounds.

If someone asks for one of these, say it's out of scope and move on.

## 7. How it is different from what exists

Wafeq, a regional accounting product sold in Egypt, already reads invoices, drafts entries, and has an AI assistant (Rashid) that takes invoices over WhatsApp and answers questions. That is for one business keeping its own books. Medad, a Saudi product, is built for accounting offices managing many clients, but I found no sign of photo capture or AI on its page.

Qaid's difference is the combination:
- Built for the **office**, not the single business.
- Built for clients with **no software at all**: a link, a photo, nothing else.
- It **chases what is missing** and **flags what is strange**, not just records what arrives.

Be honest about this in the pitch. Never say it is the first or only tool of its kind.

## 8. How it is judged and how we answer

The hackathon (Agents at Work, Egypt) scores four things. Every feature must serve at least one, or it gets cut.

| Criterion | Our answer |
|---|---|
| Works end to end | A judge scans a QR code with their own phone, photographs a receipt, and sees it appear in the accountant's board seconds later. |
| Time saved | Less typing and less chasing, per client, per month. |
| Cost saved | The office does not need another junior bookkeeper as it grows. |
| Revenue generated | The same staff can take on more clients. |

## 9. Numbers for the slides, with their limits

Label every number as an estimate unless a real accounting office confirms it.

- A bookkeeper typically handles about 20–25 small clients, at 4–6 hours per client per month. With review-and-approve instead of hand-typing, that rises to 25–30+ clients at about 3.5–4.5 hours each. **Source is a US-market article; Egyptian figures are unverified.**
- Fresh-graduate accountants in Egypt earn roughly EGP 6,000–8,000 a month at small and mid-size firms; Cairo job ads show EGP 8,000–15,000.
- **What a typical Egyptian office charges per client per month: unknown.** Ask a real accountant. This single number turns "more clients" into real revenue on the slide.

Stand-in sentence for the deck until we have real data: "If Qaid lets one bookkeeper handle about 7–13 more clients, that is [real monthly fee] × that many clients in new revenue per bookkeeper."

## 10. The demo story (2–3 minutes)

1. Ahmed opens his board. Five clients, one glance: two are complete, one is missing documents, one has something strange, one has gone silent.
2. A judge scans the QR with their own phone and photographs a receipt. It lands in Mona's inbox within seconds. Ahmed confirms it and her numbers update.
3. Ahmed asks: "Who hasn't sent documents this month?" Qaid names the clients and drafts the Arabic reminder in one click.
4. Ahmed asks: "Why did Mona's margin drop?" Qaid points to a supplier who raised prices 9%, with the figures.
5. Ahmed downloads Mona's month-end pack, ready to review.

The ending line: "Ahmed used to chase receipts for days. Now he reviews them."

## 11. Fake data for the demo

Five invented clients, three months each, each with a built-in story:
- Mona: supplier price jump, margin dip.
- Café: rent receipt missing.
- Accessories shop: a duplicate invoice.
- Aluminium workshop: unusually high VAT.
- Instagram seller: nothing uploaded this month.

Also ten printed sample receipts, invoices, and payment screenshots for live scanning. Label all of this clearly as invented. No real customer data in the repo.

## 12. Design and feel

- Calm, minimal, Apple-like: lots of white space, one quiet accent colour, never neon.
- Arabic must read right to left and look native, not translated.
- The client's phone page: one big button, a client name, a "got it" confirmation. Works on a cheap phone on a slow connection.
- The accountant's board should answer "what needs me today?" in one glance.
- Every number is clickable, so the accountant can see the documents behind it.

## 13. Build priorities

When time runs short, keep this order. Each step must work fully before starting the next.

1. A client can send a photo and the accountant sees it live.
2. The photo becomes readable, filed data.
3. The accountant reviews and confirms in bulk.
4. The client board with statuses.
5. The missing-document chaser.
6. Questions in plain language.
7. Month-end pack.
8. Stretch: a read-only view for the client.

A flawless demo of steps 1–5 beats a half-working version of everything.

## 14. Hackathon rules to respect

- The judge must be able to run it in under five minutes, from a public link, with sample data already loaded.
- Submit three things: the code repository with a clear README, short impact slides (who we built for, the workflow replaced, the measured impact), and a 2–3 minute demo video.
- Build window is Oct 1–3, 2026. Commit normally with honest dates. Do not backdate anything.
- Unknown: whether the winning agent must run on Wesam.ai's platform. Keep the core brain separate and easy to move.

## 15. Facts that must be re-checked before the demo

These come from public sources found in September 2026. Verify again; rates change.

- VAT is 14%.
- Social insurance: employer pays 18.75%, employee pays 11%, on a monthly wage between EGP 2,700 and EGP 16,700 (limits rise each January).
- Minimum wage: EGP 7,000 a month.
- VAT registration threshold: EGP 250,000 annual revenue.

If a rule or number is uncertain, mark it "to verify" in the code and the slides. Never invent one.

## 16. Working style

- Ask "does this help Ahmed or Mona in the demo?" before building anything.
- Keep it simple and boring. A working simple feature beats a clever broken one.
- If unsure between two options, choose the one a judge can see working in ten seconds.
- Small, clear commits. Tell the user what you built and what is left, in plain words.