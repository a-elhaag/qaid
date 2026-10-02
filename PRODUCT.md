# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Accountant (primary): small-office bookkeeper in Egypt running dozens of small clients. Works on laptop and phone. Month-end crunch; bulk-confirms entries, chases missing documents.
- Client (secondary): non-technical shop owner on a phone. Opens a token link (no login), snaps receipts, sees "got it". Nothing else.
- Judges/demo viewers see the app through a one-tap demo account (Ahmed).

## Product Purpose
Qaid collects clients' receipts, reads them with AI, flags problems, and prepares the books so the accountant only reviews and confirms. Success: month-end prep time collapses; the accountant trusts every number.

## Positioning
Qaid prepares, the accountant decides. Every number comes from deterministic code on real records, never from model output. Arabic-first market, EGP only.

## Operating Context
Photos of Arabic and English receipts. Pipeline: upload, two-lane read (Cohere Parse + GPT vision, fused), checks (duplicate, price jump, VAT spike), categorise, accountant confirms. Board updates live. Month-end pack exports PDF and Excel. Agent chat answers questions about the books.

## Capabilities and Constraints
- Language: English default (LTR); Arabic opt-in (RTL) via toggle; one string dictionary.
- Document states: received, extracting, needs_review, confirmed, failed.
- Categories: rent, supplies, sales, salaries, utilities, other.
- Only confirmed entries count.
- Demo account ahmed@demo.qaid.app, seeded in Task 14.

## Brand Commitments
- Calm look, no emoji (user decision).
- No UI built until the design is agreed jointly.

## Evidence on Hand
No real customers or testimonials; do not fabricate. Seed data is synthetic.

## Product Principles
- Prepare, never decide: the accountant confirms everything.
- Show the source: each number links to its receipt.
- Speed visible: live board fill is the hero moment.
- Client side is one tap, near-zero text.

## Accessibility & Inclusion
Full RTL parity with Arabic. Large touch targets on the client page. Keyboard-usable review table.
