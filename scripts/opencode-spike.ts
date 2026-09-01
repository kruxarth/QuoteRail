import 'dotenv/config';
import { z } from 'zod';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { mkdirSync, writeFileSync } from 'node:fs';
import { getEnv, fakeAiEnabled } from '@/env';
import { SELLER_MODEL } from '@/shared/constants';

const spikeSchema = z
  .object({
    merchant: z.string(),
    city: z.string(),
    currency: z.literal('INR'),
  })
  .strict();

async function main() {
  const env = getEnv();
  if (fakeAiEnabled(env) || !env.OPENCODE_GO_API_KEY) {
    throw new Error('OpenCode spike requires OPENCODE_GO_API_KEY and FAKE_AI=false');
  }

  let responsesPosts = 0;
  const openai = createOpenAI({
    apiKey: env.OPENCODE_GO_API_KEY,
    baseURL: env.OPENCODE_GO_BASE_URL,
    fetch: async (url, init) => {
      const href = String(url);
      if ((init?.method ?? 'GET').toUpperCase() === 'POST' && href.includes('/responses')) {
        responsesPosts += 1;
      }
      return globalThis.fetch(url, init);
    },
  });

  const started = Date.now();
  const result = await generateObject({
    model: openai.responses(SELLER_MODEL),
    schema: spikeSchema,
    abortSignal: AbortSignal.timeout(25_000),
    providerOptions: {
      openai: {
        store: false,
        reasoningEffort: 'low',
      },
    },
    prompt: 'Return merchant="Mosaic Events Bengaluru", city="Bengaluru", currency="INR".',
  });
  const latencyMs = Date.now() - started;
  const usage = result.usage;
  const report = {
    ok: true,
    model: SELLER_MODEL,
    base_url: env.OPENCODE_GO_BASE_URL,
    responses_post_count: responsesPosts,
    latency_ms: latencyMs,
    schema_valid: spikeSchema.safeParse(result.object).success,
    object: result.object,
    usage: usage
      ? {
          input_tokens: usage.inputTokens ?? null,
          output_tokens: usage.outputTokens ?? null,
          total_tokens: usage.totalTokens ?? null,
        }
      : null,
    provider_storage: 'disabled via providerOptions.openai.store=false',
    generated_at: new Date().toISOString(),
  };
  if (responsesPosts !== 1) {
    throw new Error(`Expected exactly one POST /responses, observed ${responsesPosts}`);
  }
  mkdirSync('docs/fixtures', { recursive: true });
  writeFileSync('docs/fixtures/opencode-spike.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
