'use client';

import { useEffect, useState } from 'react';
import { useWebMCP } from 'usewebmcp';
import { PUBLIC_MCP_TOOLS } from '@/server/mcp/tools';
import {
  ensureWebMcpRuntime,
  runAcceptQuote,
  runContinueRfq,
  runCreateCheckout,
  runGetMerchantProfile,
  runGetRfq,
  runGetTransactionStatus,
  runRequestQuote,
  runReviseQuote,
  runSearchVenueServices,
} from '@/lib/webmcp';

const TICKET = {
  type: 'string',
  minLength: 64,
  maxLength: 64,
  description:
    'Optional 64-character ticket Mosaic returned. This tab stores it after request_quote. Do not ask the human for a token.',
} as const;

const RFQ_ID = {
  type: 'string',
  description: 'RFQ id from request_quote. Optional if this tab already quoted.',
} as const;

const EMPTY_OBJECT = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string', maxLength: 120 },
    categories: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    capabilities: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    attendee_count: { type: 'integer', minimum: 1 },
    requested_date: { type: 'string', description: 'YYYY-MM-DD' },
  },
  additionalProperties: false,
} as const;

const REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    request: {
      type: 'string',
      minLength: 1,
      maxLength: 4000,
      description: 'Natural-language event brief. Date, people, dinner, budget.',
    },
  },
  required: ['request'],
  additionalProperties: false,
} as const;

const CONTINUE_SCHEMA = {
  type: 'object',
  properties: {
    rfq_id: RFQ_ID,
    answers: { type: 'string', maxLength: 4000 },
    ticket: TICKET,
  },
  additionalProperties: false,
} as const;

const GET_RFQ_SCHEMA = {
  type: 'object',
  properties: { rfq_id: RFQ_ID, ticket: TICKET },
  additionalProperties: false,
} as const;

const REVISE_SCHEMA = {
  type: 'object',
  properties: {
    quote_id: { type: 'string', description: 'Quote to revise' },
    request: { type: 'string', minLength: 1, maxLength: 4000 },
    ticket: TICKET,
  },
  required: ['quote_id', 'request'],
  additionalProperties: false,
} as const;

const ACCEPT_SCHEMA = {
  type: 'object',
  properties: {
    quote_id: { type: 'string' },
    buyer_name: { type: 'string', minLength: 1, maxLength: 80 },
    buyer_email: { type: 'string', maxLength: 120 },
    payment_term: { type: 'string', enum: ['deposit', 'full'] },
    confirmed: { type: 'boolean', description: 'Must be true to accept and hold the hall' },
    ticket: TICKET,
    rfq_id: RFQ_ID,
  },
  required: ['quote_id', 'buyer_name', 'payment_term', 'confirmed'],
  additionalProperties: false,
} as const;

const CHECKOUT_SCHEMA = {
  type: 'object',
  properties: {
    acceptance_id: { type: 'string' },
    confirmed: { type: 'boolean', description: 'Must be true to create the Razorpay Payment Link' },
    ticket: TICKET,
    rfq_id: RFQ_ID,
  },
  required: ['acceptance_id', 'confirmed'],
  additionalProperties: false,
} as const;

const STATUS_SCHEMA = {
  type: 'object',
  properties: {
    acceptance_id: { type: 'string' },
    payment_link_id: { type: 'string' },
    ticket: TICKET,
  },
  additionalProperties: false,
} as const;

export default function WebMcpBooking() {
  const [ready] = useState(() => ensureWebMcpRuntime());
  if (!ready) return null;
  return <MosaicSiteTools />;
}

function MosaicSiteTools() {
  useWebMCP({
    name: 'get_merchant_profile',
    description:
      'Public Mosaic Events Bengaluru profile, halls, and payment terms. Use site tools on this page. Do not invent HTTP GET/POST. Do not ask the human for an API token.',
    inputSchema: EMPTY_OBJECT,
    annotations: { readOnlyHint: true, openWorldHint: false },
    execute: () => runGetMerchantProfile(),
  });
  useWebMCP({
    name: 'search_venue_services',
    description: 'Search Mosaic halls and services. Availability is advisory until acceptance.',
    inputSchema: SEARCH_SCHEMA,
    annotations: { readOnlyHint: true, openWorldHint: false },
    execute: (input) => runSearchVenueServices(input),
  });
  useWebMCP({
    name: 'request_quote',
    description:
      'Submit a natural-language venue RFQ and receive priced packages. Stay on this page and keep using site tools. Do not POST to /api/enquire yourself.',
    inputSchema: REQUEST_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    execute: (input) => runRequestQuote(input),
  });
  useWebMCP({
    name: 'continue_rfq',
    description:
      'Answer clarification questions or retry a recoverable RFQ. Not available after escalation.',
    inputSchema: CONTINUE_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    execute: (input) => runContinueRfq(input),
  });
  useWebMCP({
    name: 'get_rfq',
    description: 'Read RFQ status, options, and what to do next. Does not change state.',
    inputSchema: GET_RFQ_SCHEMA,
    annotations: { readOnlyHint: true, openWorldHint: false },
    execute: (input) => runGetRfq(input),
  });
  useWebMCP({
    name: 'revise_quote',
    description: 'Request a revision or counteroffer. Cannot set a checkout amount.',
    inputSchema: REVISE_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    execute: (input) => runReviseQuote(input),
  });
  useWebMCP({
    name: 'accept_quote',
    description:
      'Accept one offered quote and hold the hall for 24 hours. Does not create a Payment Link. Consequential: holds inventory.',
    inputSchema: ACCEPT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
    execute: (input) =>
      runAcceptQuote({
        ...input,
        payment_term: input.payment_term === 'full' ? 'full' : 'deposit',
      }),
  });
  useWebMCP({
    name: 'create_checkout',
    description:
      'Create or reuse the Razorpay Payment Link for an accepted quote. No amount input. Give the human checkout_url. Never collect card details.',
    inputSchema: CHECKOUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
    execute: (input) => runCreateCheckout(input),
  });
  useWebMCP({
    name: 'get_transaction_status',
    description: 'Read persisted payment status. Does not call Razorpay or mutate state.',
    inputSchema: STATUS_SCHEMA,
    annotations: { readOnlyHint: true, openWorldHint: false },
    execute: (input) => runGetTransactionStatus(input),
  });

  useEffect(() => {
    let cancelled = false;
    const markReady = async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const tools = await document.modelContext?.getTools?.();
        if (cancelled) return;
        if ((tools?.length ?? 0) >= PUBLIC_MCP_TOOLS.length) {
          document.documentElement.dataset.webmcp = 'ready';
          document.documentElement.dataset.webmcpTools = String(tools?.length ?? 0);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };
    void markReady();
    return () => {
      cancelled = true;
      delete document.documentElement.dataset.webmcp;
      delete document.documentElement.dataset.webmcpTools;
    };
  }, []);

  return null;
}
