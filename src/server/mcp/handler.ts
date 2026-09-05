import { z } from 'zod';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { MAX_REQUEST_CHARS } from '@/shared/constants';
import { SystemClock } from '@/shared/clock';
import { DomainError } from '@/shared/result';
import { requestQuote, continueRfq, getRfqPublic, reviseQuote } from '@/server/quotes/rfq-service';
import { acceptQuote } from '@/server/quotes/accept';
import { createCheckout } from '@/server/payments/service';
import { logEvent } from '@/server/log';
import { entityIdSchema } from '@/shared/ids';
import { issueCapability, subjectFromTicket } from '@/server/quotes/capability';
import { merchantProfilePublic, searchVenueServices } from '@/server/quotes/venue-catalog';
import { readPaymentStatus } from '@/server/quotes/payment-status';

const clock = new SystemClock();
const ticketSchema = z
  .string()
  .length(64)
  .regex(/^[0-9a-f]+$/);

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

export function createQuoteRailMcpHandler() {
  return createMcpHandler(
    ({ authInfo }) => {
      const subject = String(authInfo?.extra?.subject ?? '');
      const resolveBuyer = (ticket?: string) => {
        if (subject) return subject;
        if (ticket) return subjectFromTicket(ticket);
        throw new DomainError(
          'unauthorized',
          'Pass the ticket Mosaic returned with the quote. Do not ask the human for an API token.',
          401,
        );
      };
      const server = new McpServer(
        { name: 'quoterail', version: '0.1.0' },
        {
          instructions:
            'You are booking Mosaic Events Bengaluru. If Mosaic returned a ticket, send it on every later tool call. Do not ask the human for MOSAIC_BUYER_TOKEN or to configure MCP. Prices, availability, and payment amounts are set by Mosaic. Payment credentials are entered only on Razorpay.',
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
          return toolResult(merchantProfilePublic(clock));
        },
      );

      server.registerTool(
        'search_venue_services',
        {
          title: 'Search venue services',
          description:
            'Search public halls and services. Availability is advisory until acceptance.',
          inputSchema: z.object({
            query: z.string().max(120).optional(),
            categories: z.array(z.string()).max(8).optional(),
            capabilities: z.array(z.string()).max(12).optional(),
            attendee_count: z.number().int().positive().optional(),
            requested_date: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
          }),
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async (input) => {
          return toolResult(await searchVenueServices(input));
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
            let buyerSubject = subject;
            let ticket: string | undefined;
            if (!buyerSubject) {
              const issued = issueCapability();
              ticket = issued.ticket;
              buyerSubject = issued.subject;
            }
            const result = await requestQuote({ buyerSubject, request, clock });
            logEvent('mcp.request_quote', {
              traceId: result.rfq_id,
              status: result.status,
              optionCount: result.options?.length ?? 0,
            });
            const payload = ticket
              ? {
                  ...result,
                  ticket,
                  ticket_note:
                    'Keep this ticket for this conversation. Send it on continue_rfq, get_rfq, accept_quote, and create_checkout. Do not ask the human for MOSAIC_BUYER_TOKEN.',
                }
              : result;
            return toolResult(payload, `RFQ ${result.rfq_id} status ${result.status}`);
          } catch (error) {
            return toolError(error);
          }
        },
      );

      server.registerTool(
        'continue_rfq',
        {
          title: 'Continue an RFQ',
          description:
            'Answer clarification questions or retry a recoverable RFQ. Not available after escalation — send a new request_quote instead.',
          inputSchema: z
            .object({
              rfq_id: entityIdSchema,
              answers: z.string().max(MAX_REQUEST_CHARS).default(''),
              ticket: ticketSchema.optional(),
            })
            .strict(),
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        },
        async ({ rfq_id, answers, ticket }) => {
          try {
            const result = await continueRfq({
              buyerSubject: resolveBuyer(ticket),
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
          description: 'Read back RFQ status, options, and what to do next. Does not change state.',
          inputSchema: z
            .object({ rfq_id: entityIdSchema, ticket: ticketSchema.optional() })
            .strict(),
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async ({ rfq_id, ticket }) => {
          try {
            const result = await getRfqPublic({
              buyerSubject: resolveBuyer(ticket),
              rfqId: rfq_id,
            });
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
              ticket: ticketSchema.optional(),
            })
            .strict(),
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        },
        async ({ quote_id, request, ticket }) => {
          try {
            const result = await reviseQuote({
              buyerSubject: resolveBuyer(ticket),
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
          description:
            'Accept one offered quote and hold resources for 24 hours. Does not create a Payment Link.',
          inputSchema: z
            .object({
              quote_id: entityIdSchema,
              buyer_name: z.string().min(1).max(80),
              buyer_email: z.string().email().max(120).optional(),
              payment_term: z.enum(['deposit', 'full']),
              confirmed: z.literal(true),
              ticket: ticketSchema.optional(),
            })
            .strict(),
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
        },
        async (input) => {
          try {
            const result = await acceptQuote({
              buyerSubject: resolveBuyer(input.ticket),
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
          description:
            'Create or reuse the Razorpay Payment Link for an accepted quote. No amount input.',
          inputSchema: z
            .object({
              acceptance_id: entityIdSchema,
              confirmed: z.literal(true),
              ticket: ticketSchema.optional(),
            })
            .strict(),
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
        },
        async ({ acceptance_id, ticket }) => {
          try {
            const result = await createCheckout({
              buyerSubject: resolveBuyer(ticket),
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
              ticket: ticketSchema.optional(),
            })
            .strict(),
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async (input) => {
          try {
            return toolResult(
              await readPaymentStatus({
                buyerSubject: resolveBuyer(input.ticket),
                acceptanceId: input.acceptance_id,
                paymentLinkId: input.payment_link_id,
              }),
            );
          } catch (error) {
            return toolError(error);
          }
        },
      );

      return server;
    },
    { responseMode: 'json' },
  );
}
