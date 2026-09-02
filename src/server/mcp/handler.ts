import { z } from 'zod';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { merchants, offerings, paymentLinks, quoteAcceptances, quotes, rfqs } from '@/db/schema';
import { MERCHANT_NAME, MAX_REQUEST_CHARS, MAX_PAYMENT_FAILURES } from '@/shared/constants';
import { SystemClock } from '@/shared/clock';
import { DomainError } from '@/shared/result';
import { requestQuote, continueRfq, getRfqPublic, reviseQuote } from '@/server/quotes/rfq-service';
import { acceptQuote } from '@/server/quotes/accept';
import { createCheckout } from '@/server/payments/service';
import { MERCHANT_ID } from '@/server/catalog/seed';
import { demoDates } from '@/server/availability/slots';
import { PUBLIC_MCP_TOOLS } from '@/server/mcp/tools';
import { logEvent } from '@/server/log';
import { entityIdSchema } from '@/shared/ids';

const clock = new SystemClock();

function toolResult<T extends Record<string, unknown>>(data: T, text?: string) {
  return {
    content: [{ type: 'text' as const, text: text ?? JSON.stringify(data) }],
    structuredContent: data,
  };
}

function toolError(error: unknown) {
  const message = error instanceof DomainError ? error.message : 'Request failed';
  const code = error instanceof DomainError ? error.code : 'error';
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: code, message }) }],
    structuredContent: { error: code, message },
  };
}

async function assertOwnedRfq(id: string, subject: string) {
  const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
  if (!rfq || rfq.buyerSubject !== subject) throw new DomainError('not_found', 'RFQ not found', 404);
  return rfq;
}

export function createQuoteRailMcpHandler() {
  return createMcpHandler(
    ({ authInfo }) => {
      const subject = String(authInfo?.extra?.subject ?? authInfo?.clientId ?? '');
      const server = new McpServer(
        { name: 'quoterail', version: '0.1.0' },
        {
          instructions:
            'QuoteRail transacts with Mosaic Events Bengaluru. Prices, availability, and payment amounts are merchant-controlled. Payment credentials are entered only on Razorpay. Never send a checkout amount; accept a quote and create checkout from server-owned terms.',
        },
      );

      server.registerTool(
        'get_merchant_profile',
        {
          title: 'Merchant profile',
          description: 'Public Mosaic Events profile, halls, and payment terms.',
          inputSchema: z.object({}).strict(),
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        },
        async () => {
          const dates = demoDates(clock);
          return toolResult({
            name: MERCHANT_NAME,
            city: 'Bengaluru',
            currency: 'INR',
            quote_validity_minutes: 60,
            payment_terms: ['deposit', 'full'],
            deposit: '40% of the accepted full quote total',
            halls: ['Grand Hall (180)', 'Studio Hall (120)'],
            services: ['AV', 'catering', 'valet', 'branded stage', 'event operations'],
            demo_friday: dates.friday,
          });
        },
      );

      server.registerTool(
        'search_venue_services',
        {
          title: 'Search venue services',
          description: 'Search public halls and services. Availability is advisory until acceptance.',
          inputSchema: z.object({
            query: z.string().max(120).optional(),
            categories: z.array(z.string()).max(8).optional(),
            capabilities: z.array(z.string()).max(12).optional(),
            attendee_count: z.number().int().positive().optional(),
            requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          }),
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async (input) => {
          const rows = await db.select().from(offerings).where(eq(offerings.merchantId, MERCHANT_ID));
          const filtered = rows.filter((row) => {
            if (input.categories?.length && !input.categories.includes(row.category)) return false;
            if (input.query && !`${row.name} ${row.description}`.toLowerCase().includes(input.query.toLowerCase())) {
              return false;
            }
            if (input.attendee_count && row.category === 'hall' && (row.capacityUnits ?? 0) < input.attendee_count) {
              return false;
            }
            return true;
          });
          return toolResult({
            services: filtered.map((row) => ({
              code: row.code,
              name: row.name,
              category: row.category,
              capabilities: row.capabilities,
              capacity_label: row.capacityLabel,
            })),
            availability_note: 'Date availability is advisory until atomic acceptance.',
          });
        },
      );

      server.registerTool(
        'request_quote',
        {
          title: 'Request a quote',
          description: 'Submit a natural-language venue RFQ and receive feasible alternatives.',
          inputSchema: z.object({ request: z.string().min(1).max(MAX_REQUEST_CHARS) }).strict(),
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        },
        async ({ request }) => {
          try {
            const result = await requestQuote({ buyerSubject: subject, request, clock });
            logEvent('mcp.request_quote', {
              traceId: result.rfq_id,
              status: result.status,
              optionCount: result.options?.length ?? 0,
            });
            return toolResult(result, `RFQ ${result.rfq_id} status ${result.status}`);
          } catch (error) {
            return toolError(error);
          }
        },
      );

      server.registerTool(
        'continue_rfq',
        {
          title: 'Continue an RFQ',
          description: 'Answer clarification questions or retry a recoverable RFQ.',
          inputSchema: z
            .object({
              rfq_id: entityIdSchema,
              answers: z.string().max(MAX_REQUEST_CHARS).default(''),
            })
            .strict(),
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        },
        async ({ rfq_id, answers }) => {
          try {
            const result = await continueRfq({
              buyerSubject: subject,
              rfqId: rfq_id,
              answers,
              clock,
            });
            return toolResult(result, `RFQ ${result.rfq_id} status ${result.status}`);
          } catch (error) {
            return toolError(error);
          }
        },
      );

      server.registerTool(
        'get_rfq',
        {
          title: 'Get RFQ',
          description: 'Read back RFQ status, options, and payment summary. Does not change state.',
          inputSchema: z.object({ rfq_id: entityIdSchema }).strict(),
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async ({ rfq_id }) => {
          try {
            const result = await getRfqPublic({ buyerSubject: subject, rfqId: rfq_id });
            return toolResult(result);
          } catch (error) {
            return toolError(error);
          }
        },
      );

      server.registerTool(
        'revise_quote',
        {
          title: 'Revise a quote',
          description: 'Request a revision or counteroffer. Cannot set a checkout amount.',
          inputSchema: z
            .object({
              quote_id: entityIdSchema,
              request: z.string().min(1).max(MAX_REQUEST_CHARS),
            })
            .strict(),
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        },
        async ({ quote_id, request }) => {
          try {
            const result = await reviseQuote({
              buyerSubject: subject,
              quoteId: quote_id,
              request,
              clock,
            });
            return toolResult(result);
          } catch (error) {
            return toolError(error);
          }
        },
      );

      server.registerTool(
        'accept_quote',
        {
          title: 'Accept a quote',
          description: 'Accept one offered quote and hold resources for 24 hours. Does not create a Payment Link.',
          inputSchema: z
            .object({
              quote_id: entityIdSchema,
              buyer_name: z.string().min(1).max(80),
              buyer_email: z.string().email().max(120).optional(),
              payment_term: z.enum(['deposit', 'full']),
              confirmed: z.literal(true),
            })
            .strict(),
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
        },
        async (input) => {
          try {
            const result = await acceptQuote({
              buyerSubject: subject,
              quoteId: input.quote_id,
              buyerName: input.buyer_name,
              buyerEmail: input.buyer_email,
              paymentTerm: input.payment_term,
              confirmed: true,
              clock,
            });
            return toolResult(result, `Accepted ${result.acceptance_id}`);
          } catch (error) {
            return toolError(error);
          }
        },
      );

      server.registerTool(
        'create_checkout',
        {
          title: 'Create checkout',
          description: 'Create or reuse the Razorpay Payment Link for an accepted quote. No amount input.',
          inputSchema: z
            .object({
              acceptance_id: entityIdSchema,
              confirmed: z.literal(true),
            })
            .strict(),
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
        },
        async ({ acceptance_id }) => {
          try {
            const result = await createCheckout({
              buyerSubject: subject,
              acceptanceId: acceptance_id,
              confirmed: true,
              clock,
            });
            return toolResult(result);
          } catch (error) {
            return toolError(error);
          }
        },
      );

      server.registerTool(
        'get_transaction_status',
        {
          title: 'Transaction status',
          description: 'Read persisted payment status. Does not call Razorpay or mutate state.',
          inputSchema: z
            .object({
              acceptance_id: entityIdSchema.optional(),
              payment_link_id: entityIdSchema.optional(),
            })
            .strict(),
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async (input) => {
          try {
            let link;
            if (input.payment_link_id) {
              [link] = await db
                .select()
                .from(paymentLinks)
                .where(eq(paymentLinks.id, input.payment_link_id))
                .limit(1);
            } else if (input.acceptance_id) {
              [link] = await db
                .select()
                .from(paymentLinks)
                .where(eq(paymentLinks.acceptanceId, input.acceptance_id))
                .limit(1);
            }
            if (!link) throw new DomainError('not_found', 'Transaction not found', 404);
            const [acceptance] = await db
              .select()
              .from(quoteAcceptances)
              .where(eq(quoteAcceptances.id, link.acceptanceId))
              .limit(1);
            if (!acceptance) throw new DomainError('not_found', 'Transaction not found', 404);
            await assertOwnedRfq(acceptance.rfqId, subject);
            return toolResult({
              status: link.status,
              failure_count: link.failureCount,
              retry_eligible: link.status === 'issued' && link.failureCount <= MAX_PAYMENT_FAILURES,
              amount: link.amount.toString(),
              currency: link.currency,
              updated_at: link.updatedAt.toISOString(),
            });
          } catch (error) {
            return toolError(error);
          }
        },
      );

      void merchants;
      void quotes;
      void PUBLIC_MCP_TOOLS;
      return server;
    },
    { responseMode: 'json' },
  );
}
