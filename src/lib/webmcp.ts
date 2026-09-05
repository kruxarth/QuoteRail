const SESSION_KEY = 'mosaic.webmcp.v1';

export type WebMcpSession = {
  ticket?: string;
  rfqId?: string;
  quoteId?: string;
  acceptanceId?: string;
  paymentLinkId?: string;
};

type RegisteredTool = {
  name: string;
  description: string;
  title?: string;
  inputSchema?: unknown;
  annotations?: unknown;
  execute: (input: Record<string, unknown>) => unknown;
};

type ModelContextSurface = {
  registerTool: (def: RegisteredTool, options?: { signal?: AbortSignal }) => Promise<void>;
  getTools?: () => Promise<unknown[]>;
  executeTool?: (tool: { name: string }, inputArgsJson?: string) => Promise<string>;
};

function documentModelContext(doc: Document): ModelContextSurface | undefined {
  return (doc as Document & { modelContext?: ModelContextSurface }).modelContext;
}

function installWebMcpShim() {
  if (typeof documentModelContext(document)?.registerTool === 'function') return;
  const tools = new Map<string, RegisteredTool>();
  const modelContext = {
    async registerTool(def: RegisteredTool, options?: { signal?: AbortSignal }) {
      tools.set(def.name, def);
      options?.signal?.addEventListener('abort', () => {
        if (tools.get(def.name) === def) tools.delete(def.name);
      });
    },
    async getTools() {
      return [...tools.values()]
        .map((tool) => ({
          name: tool.name,
          title: tool.title ?? '',
          description: tool.description,
          ...(tool.inputSchema !== undefined ? { inputSchema: tool.inputSchema } : {}),
          origin: location.origin,
          window,
          ...(tool.annotations ? { annotations: tool.annotations } : {}),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async executeTool(tool: { name: string }, inputArgsJson = '{}') {
      const def = tools.get(tool.name);
      if (!def) throw new Error(`Tool not found: ${tool.name}`);
      const args =
        typeof inputArgsJson === 'string'
          ? (JSON.parse(inputArgsJson || '{}') as Record<string, unknown>)
          : inputArgsJson;
      const result = await def.execute(args);
      return typeof result === 'string' ? result : JSON.stringify(result);
    },
  };
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    enumerable: true,
    get(): ModelContextSurface {
      return modelContext;
    },
  });
}

export function ensureWebMcpRuntime(): boolean {
  if (typeof document === 'undefined') return false;
  if (typeof documentModelContext(document)?.registerTool === 'function') return true;
  installWebMcpShim();
  return typeof documentModelContext(document)?.registerTool === 'function';
}

export function idsFromPayload(data: Record<string, unknown>): WebMcpSession {
  const patch: WebMcpSession = {};
  if (typeof data.ticket === 'string' && /^[0-9a-f]{64}$/.test(data.ticket))
    patch.ticket = data.ticket;
  if (typeof data.rfq_id === 'string' && data.rfq_id) patch.rfqId = data.rfq_id;
  if (typeof data.quote_id === 'string' && data.quote_id) patch.quoteId = data.quote_id;
  if (typeof data.acceptance_id === 'string' && data.acceptance_id)
    patch.acceptanceId = data.acceptance_id;
  if (typeof data.payment_link_id === 'string' && data.payment_link_id)
    patch.paymentLinkId = data.payment_link_id;
  const options = data.options;
  if (Array.isArray(options) && options[0] && typeof options[0] === 'object') {
    const first = options[0] as Record<string, unknown>;
    if (typeof first.quote_id === 'string' && first.quote_id) patch.quoteId = first.quote_id;
  }
  return patch;
}

export function readSession(): WebMcpSession {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WebMcpSession;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function patchSession(partial: WebMcpSession) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...readSession(), ...partial }));
}

export function rememberFromPayload(data: Record<string, unknown>) {
  const patch = idsFromPayload(data);
  if (Object.keys(patch).length) patchSession(patch);
}

export async function mosaicJson(
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const headers = new Headers(init?.headers);
  const ticket = readSession().ticket;
  if (ticket) headers.set('X-Mosaic-Ticket', ticket);
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  try {
    const response = await fetch(path, { ...init, headers });
    const data = (await response.json().catch(() => ({
      error: 'error',
      message: `HTTP ${response.status}`,
    }))) as Record<string, unknown>;
    if (data && typeof data === 'object' && !Array.isArray(data)) rememberFromPayload(data);
    return data;
  } catch {
    return { error: 'network', message: 'Network failed' };
  }
}

function requireRfqId(rfqId?: string) {
  return rfqId || readSession().rfqId;
}

export async function runGetMerchantProfile() {
  return mosaicJson('/api/venue');
}

export async function runSearchVenueServices(input: {
  query?: string;
  categories?: string[];
  capabilities?: string[];
  attendee_count?: number;
  requested_date?: string;
}) {
  const params = new URLSearchParams();
  if (input.query) params.set('query', input.query);
  if (input.categories?.length) params.set('categories', input.categories.join(','));
  if (input.capabilities?.length) params.set('capabilities', input.capabilities.join(','));
  if (input.attendee_count) params.set('attendee_count', String(input.attendee_count));
  if (input.requested_date) params.set('requested_date', input.requested_date);
  const query = params.toString();
  return mosaicJson(`/api/venue/services${query ? `?${query}` : ''}`);
}

export async function runRequestQuote(input: { request: string }) {
  const data = await mosaicJson('/api/enquire', {
    method: 'POST',
    body: JSON.stringify({ request: input.request }),
  });
  return {
    ...data,
    webmcp_note:
      'This tab stored the ticket. Keep using site tools here. Do not invent HTTP. Do not ask the human for a token.',
  };
}

export async function runContinueRfq(input: {
  rfq_id?: string;
  answers?: string;
  ticket?: string;
}) {
  if (input.ticket) patchSession({ ticket: input.ticket });
  const rfqId = requireRfqId(input.rfq_id);
  if (!rfqId)
    return { error: 'invalid_input', message: 'rfq_id is missing. Call request_quote first.' };
  return mosaicJson(`/api/enquire/${rfqId}`, {
    method: 'POST',
    body: JSON.stringify({ answers: input.answers ?? '', ticket: readSession().ticket }),
  });
}

export async function runGetRfq(input: { rfq_id?: string; ticket?: string }) {
  if (input.ticket) patchSession({ ticket: input.ticket });
  const rfqId = requireRfqId(input.rfq_id);
  if (!rfqId)
    return { error: 'invalid_input', message: 'rfq_id is missing. Call request_quote first.' };
  return mosaicJson(`/api/enquire/${rfqId}`);
}

export async function runReviseQuote(input: {
  quote_id: string;
  request: string;
  ticket?: string;
}) {
  if (input.ticket) patchSession({ ticket: input.ticket });
  return mosaicJson('/api/venue/revise', {
    method: 'POST',
    body: JSON.stringify({
      quote_id: input.quote_id,
      request: input.request,
      ticket: readSession().ticket,
    }),
  });
}

export async function runAcceptQuote(input: {
  quote_id: string;
  buyer_name: string;
  buyer_email?: string;
  payment_term: 'deposit' | 'full';
  confirmed: boolean;
  ticket?: string;
  rfq_id?: string;
}) {
  if (input.ticket) patchSession({ ticket: input.ticket });
  if (input.confirmed !== true) {
    return { error: 'invalid_input', message: 'Set confirmed: true to accept.' };
  }
  const rfqId = requireRfqId(input.rfq_id);
  if (!rfqId)
    return { error: 'invalid_input', message: 'rfq_id is missing. Call request_quote first.' };
  const data = await mosaicJson(`/api/enquire/${rfqId}/accept`, {
    method: 'POST',
    body: JSON.stringify({
      quote_id: input.quote_id,
      buyer_name: input.buyer_name,
      buyer_email: input.buyer_email,
      payment_term: input.payment_term,
      confirmed: true,
      ticket: readSession().ticket,
    }),
  });
  return {
    ...data,
    next_action:
      'Call create_checkout with this acceptance_id. Give the human checkout_url. Do not collect card details.',
  };
}

export async function runCreateCheckout(input: {
  acceptance_id: string;
  confirmed: boolean;
  ticket?: string;
  rfq_id?: string;
}) {
  if (input.ticket) patchSession({ ticket: input.ticket });
  if (input.confirmed !== true) {
    return { error: 'invalid_input', message: 'Set confirmed: true to create checkout.' };
  }
  const rfqId = requireRfqId(input.rfq_id);
  if (!rfqId)
    return { error: 'invalid_input', message: 'rfq_id is missing. Call request_quote first.' };
  return mosaicJson(`/api/enquire/${rfqId}/checkout`, {
    method: 'POST',
    body: JSON.stringify({
      acceptance_id: input.acceptance_id,
      confirmed: true,
      ticket: readSession().ticket,
    }),
  });
}

export async function runGetTransactionStatus(input: {
  acceptance_id?: string;
  payment_link_id?: string;
  ticket?: string;
}) {
  if (input.ticket) patchSession({ ticket: input.ticket });
  const acceptanceId = input.acceptance_id || readSession().acceptanceId;
  const paymentLinkId = input.payment_link_id || readSession().paymentLinkId;
  const params = new URLSearchParams();
  if (acceptanceId) params.set('acceptance_id', acceptanceId);
  if (paymentLinkId) params.set('payment_link_id', paymentLinkId);
  const query = params.toString();
  if (!query) {
    return { error: 'invalid_input', message: 'acceptance_id or payment_link_id is required.' };
  }
  return mosaicJson(`/api/venue/transaction?${query}`);
}
