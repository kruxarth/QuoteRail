# Demo script

Reset **before** you roll. New ChatGPT thread. Model **GPT-5.6 Sol or Terra** (not Luna). Tabs ready: GitHub, live Mosaic, ChatGPT, `docs/architecture.html`.

Locked ChatGPT prompt (paste this, do not type localhost):

> Book Mosaic Events in Indiranagar for a 120-person product launch on Friday 11 September 2026, 5 PM to 11 PM. Theatre layout, professional LED and PA, premium dinner with 30 Jain and 10 vegan, valet, branded stage. Keep the total under ₹2,20,000. Forty percent deposit today. If Friday exact is over budget, take the next best package that still has the dinner and the room. Then accept that package and open checkout.

Expected: ₹1,96,000 Friday Grand standard · ₹2,03,000 Thursday Studio premium · ₹2,48,000 Friday Grand exact. Accept Thursday. Deposit **₹81,200**. Approval uses the full **₹2,03,000**. Pay succeeds on the **first** Razorpay attempt.

---

## Off camera

1. Staff **Reset calendar** on live, or `DEMO_RESET_ENABLED=true pnpm demo:reset` locally then deploy.
2. ChatGPT: new chat, Sol or Terra, composer on.
3. Open Mosaic in ChatGPT’s in-app browser once, confirm **Site tools** in the address bar, leave that tab.
4. Razorpay test card ready. Architecture HTML already open, zoomed so the arrows read.

Do not: 90% off, fail the card, paste a token, say QuoteRail on the house, invent a chat with the seller.

---

## 0:00–0:40 · GitHub

Open [github.com/kruxarth/QuoteRail](https://github.com/kruxarth/QuoteRail). Stay on README. Scroll the mermaid once. Stop on the nine tools.

**Say:**

This is QuoteRail. Razorpay AI Buildathon, Track 01 — agentic commerce.

The merchant is Mosaic Events in Indiranagar. We did not build a shopping bot. We made a venue that an existing buyer agent can transact against.

Nine tools. Same names everywhere: profile, search, quote, continue, read, revise, accept, checkout, payment status.

The recorded path is WebMCP. ChatGPT opens the house. The page registers those tools in the tab. No API token.

If the agent is not in a WebMCP browser, we still have a remote MCP server at `/api/mcp`, plus a buyer token for a saved connector. That is the fallback, not the demo.

---

## 0:40–1:25 · Live house

Open [quoterail-two.vercel.app](https://quoterail-two.vercel.app). Hero. Scroll Grand and Studio. Pause on “WebMCP site tools · live in this tab.” Optional: `/agent` — “No token.” Do not log into staff.

**Say:**

This is the house a human would see. Two halls. Dinner, AV, valet, stage.

That kicker is the point. The tools are on this origin. ChatGPT does not need a key from us. After the first quote, the tab keeps the ticket. Later tools send it.

Fallback, if this browser cannot do WebMCP: remote MCP with a buyer token, or plain HTTP with that same ticket. Today we use the site tools.

---

## 1:25–3:25 · ChatGPT, first-try pay

Switch to ChatGPT. Mosaic loaded. Point at **Site tools**. Paste the locked prompt. Wait. Do not narrate every tool call.

When three packages appear, click Thursday Studio (₹2,03,000). Let it accept and `create_checkout`. Open the Razorpay link. Pay once. Success. Stop. Do not collect the remaining 60%.

**Say, while it thinks:**

Ordinary language. Date, people, dinner, a budget. ChatGPT is the buyer. Mosaic’s site tools do the work in this tab.

**When packages land:**

Three priced nights. Friday Grand with standard dinner is under budget at one lakh ninety-six. Friday exact premium is two lakh forty-eight — over the ceiling, so it is there as the honest option, not the one we take. Thursday Studio, premium dinner, two lakh three. That is the one that fits.

The model proposed packages. It did not type those rupees. Node priced them from the catalog.

**On accept / checkout:**

Accept Thursday. Forty percent deposit is eighty-one thousand two hundred. Checkout amount comes from the accepted quote. ChatGPT cannot change it.

**On Razorpay success:**

Paid on the first attempt. Card never touched Mosaic. A signed webhook is what commits the hall.

---

## 3:25–4:50 · Architecture

Cut to `docs/architecture.html`. Trace buyer → site tools → app → planner → policy → Razorpay. Optional flash of staff board: enquiry quoted, Thursday held then committed. Back to the house. End.

**Say:**

ChatGPT on the left is the buyer. Sol or Terra. It only calls tools.

Those tools hit our application, not the model’s imagination. `request_quote` runs a bounded planner: gpt-5.6-luna, twice. Extract the brief. Propose two or three bundles of catalog codes. No prices in that JSON. If it emits a total, we drop it.

Node prices the bundle. Policy checks lead time, capacity, margin, the ten-percent discount cap. Accept holds the slot twenty-four hours. Checkout asks Razorpay for the deposit on that quote. Webhook commits it.

We call that a seller agent in the writeup. In the code it is not a loop and it is not a cashier. It is extract and plan. Money stays in Node so a prompt cannot move the rate card.

WebMCP is how a browser agent books with no token. Remote MCP plus a buyer token is how a connector that is not in this tab still books. Same nine tools. Same invariants.

The remaining sixty percent is out of scope. The demo is: agent quotes, human pays, hall is held.

---

## If something slips

| What happens | What you do |
|---|---|
| No Site tools | Say Luna has WebMCP off, confirm Sol/Terra, reload Mosaic in the in-app browser. |
| Friday exact chosen | “That’s over the two-twenty ceiling. Take Thursday.” |
| ChatGPT asks for a token | “No. Ticket is in the tab.” |
| Payment Link slow | Keep the tab. Do not type an amount. |
| Bank page dies | Cut to a real test-mode success you already captured. Do not fake paid. |
| Quote 404 / empty calendar | You did not reset. Stop. Reset. New thread. |

Keep one unpaid Payment Link from a prior RFQ as a cutaway. Do not use it unless Razorpay is down.
