import 'dotenv/config';
import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { getEnv } from '@/env';

async function main() {
  const env = getEnv();
  const url = new URL(`${env.APP_BASE_URL}/api/mcp`);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: { Authorization: `Bearer ${env.BUYER_MCP_TOKEN}` },
    },
  });
  const client = new Client({ name: 'quoterail-smoke', version: '0.1.0' });
  await client.connect(transport);
  const tools = await client.listTools();
  console.log(
    'tools',
    tools.tools.map((t) => t.name),
  );
  const profile = await client.callTool({ name: 'get_merchant_profile', arguments: {} });
  console.log('profile', JSON.stringify(profile.structuredContent ?? profile.content, null, 2));
  const unclear = await client.callTool({
    name: 'request_quote',
    arguments: { request: 'We need a Bengaluru venue sometime.' },
  });
  const unclearData = (unclear.structuredContent ?? {}) as { rfq_id?: string; status?: string };
  console.log('clarification', unclearData.status, unclearData.rfq_id);
  if (unclearData.rfq_id) {
    const continued = await client.callTool({
      name: 'continue_rfq',
      arguments: {
        rfq_id: unclearData.rfq_id,
        answers:
          '120 people, Friday 2026-09-11 evening, theatre, budget ₹2,20,000, premium dinner 30 Jain 10 vegan, LED, valet, branded stage, 40% deposit.',
      },
    });
    console.log('continued', JSON.stringify(continued.structuredContent, null, 2).slice(0, 1000));
    const readBack = await client.callTool({
      name: 'get_rfq',
      arguments: { rfq_id: unclearData.rfq_id },
    });
    console.log('get_rfq', (readBack.structuredContent as { status?: string })?.status);
  }
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
