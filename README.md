# QuoteRail

Razorpay AI Buildathon · Track 01: AI Growth & Agentic Commerce.

**QuoteRail turns complex corporate-event enquiries into feasible, reservable, policy-compliant Razorpay checkouts, while preventing buyer agents from manipulating price, availability, or payment state.**

This is a merchant-side system for **Mosaic Events Bengaluru**. The buyer brings an existing MCP-capable agent (the recorded demo uses OpenCode). QuoteRail is not another shopping agent, not WebMCP, and not Razorpay's official MCP — it reasons over venue constraints, then lets deterministic code own price, capacity, policy, and payment state.

## Safety invariants

- The model never sets prices, availability, or payment amounts.
- Checkout amounts come only from an immutable accepted quote.
- Webhooks are authoritative only after HMAC verification.
- Offered alternatives do not reserve capacity; acceptance does, for 24 hours.
- Approval ceilings always use the full quote total, even for a 40% deposit.

## Setup

Node 22, pnpm, Docker.

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Tests

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm eval
```

`pnpm eval` runs the 30 labeled RFQs through the fake planner and writes `docs/EVALS.md`. Live OpenCode Go evals need `OPENCODE_GO_API_KEY` and are opt-in.

Real Razorpay calls require `REAL_RAZORPAY_TESTS_ENABLED=true` and test keys. They are never run in CI. Razorpay test mode has a 30 Payment Link quota.

## MCP (OpenCode)

See `/agent` for the live URL. Locked config:

See `/agent` for the live URL. Locked config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "quoterail": {
      "type": "remote",
      "url": "https://<deployment>/api/mcp",
      "enabled": true,
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:QUOTERAIL_BUYER_TOKEN}"
      },
      "timeout": 60000
    }
  }
}
```

Pinned packages: Next.js 16.3.3, `@modelcontextprotocol/server` 2.0.0, `ai` 7.x, `@ai-sdk/openai` 4.x. OpenCode Go `baseURL` is `https://opencode.ai/zen/go/v1`; the Responses factory posts to `/responses`. Seller model is `gpt-5.6-luna`.

## Limitations

- One merchant, INR, no GST line, no refunds, no remaining-60% collection.
- Credential-gated and not claimed as verified here: live OpenCode Go evals, OpenCode buyer-agent connection, real Payment Link spike, Vercel/Neon deploy, pitch video.
- Local demo uses `FAKE_AI=true` and `FAKE_PAYMENTS=true`.
- No claim of measured conversion uplift.

## License

MIT
