# Threat model

## Assets

- Merchant catalog costs and margin floors
- Razorpay test keys and webhook secret
- Buyer bearer token and merchant admin password
- Accepted quote amounts and Payment Link URLs
- Resource reservations

## Controls

| Threat | Control |
|---|---|
| Prompt injection / 90% discount | Buyer text is data; Zod schemas; policy engine; audit |
| Buyer-supplied amount | Checkout input has no amount/currency/discount |
| Unknown offering / fabricated slot | Server catalog + `resource_slots` only |
| Over-capacity / buffer overlap | Atomic slot locks + capacity recompute |
| Dietary mismatch | Meal balance and dietary satisfaction rules |
| Quote ID enumeration | Buyer subject must own the RFQ |
| Expired quote | Offer expiry checked inside the acceptance transaction |
| Duplicate checkout | Unique acceptance_id on payment_links; reuse issued/creating |
| Amount tampering | Amount looked up from accepted quote |
| Invalid webhook | HMAC over raw body; 401; no mutation |
| Replayed webhook | Unique body hash |
| Out-of-order webhook | Ignore status regression |
| Provider timeout after create | Lookup by reference_id or `manual_reconciliation_required` |
| Cross-auth | MCP token ≠ merchant cookie |
| Oversized input | 4,000 character bound |

## Residual risks

- Static demo bearer token is shared. Suitable for a judged demo, not production multi-buyer auth.
- Test-mode Razorpay quota of 30 Payment Links. Fake provider is used in CI.
- No live-mode support by design.
