export const PUBLIC_MCP_TOOLS = [
  'get_merchant_profile',
  'search_venue_services',
  'request_quote',
  'continue_rfq',
  'get_rfq',
  'revise_quote',
  'accept_quote',
  'create_checkout',
  'get_transaction_status',
] as const;

export type PublicMcpTool = (typeof PUBLIC_MCP_TOOLS)[number];
