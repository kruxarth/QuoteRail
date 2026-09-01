import { describe, expect, it } from 'vitest';
import { handle as mcpHandle } from '@/app/api/mcp/route';
import { PUBLIC_MCP_TOOLS } from '@/server/mcp/tools';

describe('MCP HTTP', () => {
  it('rejects unauthorized and non-buyer credentials', async () => {
    const url = 'http://localhost:3000/api/mcp';
    const missing = await mcpHandle(new Request(url, { method: 'POST', body: '{}' }));
    expect(missing.status).toBe(401);
    const adminAsBearer = await mcpHandle(
      new Request(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-admin-password' },
        body: '{}',
      }),
    );
    expect(adminAsBearer.status).toBe(401);
  });

  it('lists exactly the locked tools for an authorized buyer', async () => {
    const init = await mcpHandle(
      new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-buyer-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'quoterail-test', version: '0.0.1' },
          },
        }),
      }),
    );
    expect(init.status).toBe(200);
    const session = init.headers.get('mcp-session-id');
    await mcpHandle(
      new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-buyer-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          ...(session ? { 'mcp-session-id': session } : {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        }),
      }),
    );
    const listed = await mcpHandle(
      new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-buyer-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          ...(session ? { 'mcp-session-id': session } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      }),
    );
    expect(listed.status).toBe(200);
    const raw = await listed.text();
    const dataLine = raw
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('data:'));
    const payload = JSON.parse(dataLine ? dataLine.slice(5).trim() : raw) as {
      result?: { tools?: Array<{ name: string; inputSchema?: { properties?: Record<string, unknown> } }> };
    };
    const names = (payload.result?.tools ?? []).map((tool) => tool.name).sort();
    expect(names).toEqual([...PUBLIC_MCP_TOOLS].sort());
    const checkout = payload.result?.tools?.find((tool) => tool.name === 'create_checkout');
    expect(checkout?.inputSchema?.properties).not.toHaveProperty('amount');
    expect(checkout?.inputSchema?.properties).not.toHaveProperty('currency');
    expect(checkout?.inputSchema?.properties).not.toHaveProperty('discount');
  });
});
