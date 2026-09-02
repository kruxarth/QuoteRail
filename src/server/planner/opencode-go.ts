import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getEnv } from '@/env';
import { SELLER_MODEL } from '@/shared/constants';
import { candidateSetSchema, extractedRequirementsSchema } from '@/shared/schemas';
import { istDateString, type Clock } from '@/shared/clock';
import { EXTRACTION_SYSTEM_PROMPT } from '@/server/planner/prompts/extraction';
import { PLANNER_SYSTEM_PROMPT } from '@/server/planner/prompts/planning';
import { assertNoPriceFields } from '@/shared/schemas';
import type { CandidateSet, ExtractedRequirements } from '@/shared/schemas';
import type { ModelAdapter } from '@/server/planner/types';
import { demoDates } from '@/server/availability/slots';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenCodeGoAdapter implements ModelAdapter {
  private readonly openai;

  constructor() {
    const env = getEnv();
    this.openai = createOpenAI({
      apiKey: env.OPENCODE_GO_API_KEY,
      baseURL: env.OPENCODE_GO_BASE_URL,
    });
  }

  private model() {
    return this.openai.responses(SELLER_MODEL);
  }

  private async withRetry<T>(fn: () => Promise<T>, deadline: AbortSignal): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (deadline.aborted) throw error;
      await sleep(150 + Math.floor(Math.random() * 250));
      if (deadline.aborted) throw error;
      return fn();
    }
  }

  async extract(input: {
    request: string;
    clock: Clock;
    history?: string[];
    signal?: AbortSignal;
  }): Promise<ExtractedRequirements> {
    const signal = input.signal ?? AbortSignal.timeout(20_000);
    const now = input.clock.now();
    return this.withRetry(async () => {
      const result = await generateObject({
        model: this.model(),
        schema: extractedRequirementsSchema,
        system: EXTRACTION_SYSTEM_PROMPT,
        abortSignal: signal,
        providerOptions: {
          openai: {
            store: false,
            reasoningEffort: 'low',
          },
        },
        prompt: [
          `Current instant: ${now.toISOString()}`,
          `Calendar date: ${istDateString(now)}`,
          `Timezone: Asia/Kolkata`,
          '',
          'UNTRUSTED_BUYER_DATA_BEGIN',
          input.request,
          ...(input.history ?? []).map((item) => `HISTORY: ${item}`),
          'UNTRUSTED_BUYER_DATA_END',
        ].join('\n'),
      });
      return result.object;
    }, signal);
  }

  async plan(input: {
    requirements: ExtractedRequirements;
    offerings: Array<{ code: string; name: string; category: string; capacityUnits: number | null; capabilities: string[] }>;
    availableSlots: Array<{ code: string; date: string; window: string; available: boolean }>;
    feedback?: string;
    clock: Clock;
    signal?: AbortSignal;
  }): Promise<CandidateSet> {
    const signal = input.signal ?? AbortSignal.timeout(20_000);
    return this.withRetry(async () => {
      const result = await generateObject({
        model: this.model(),
        schema: candidateSetSchema,
        system: PLANNER_SYSTEM_PROMPT,
        abortSignal: signal,
        providerOptions: {
          openai: {
            store: false,
            reasoningEffort: 'low',
          },
        },
        prompt: [
          `Current instant: ${input.clock.now().toISOString()}`,
          `Calendar date: ${istDateString(input.clock.now())}`,
          `Timezone: Asia/Kolkata`,
          `Earliest Friday evening that meets 48-hour lead: ${demoDates(input.clock).friday}`,
          `Thursday alternative: ${demoDates(input.clock).thursday}`,
          '',
          'ACTIVE_OFFERINGS',
          JSON.stringify(input.offerings),
          'ADVISORY_SLOTS',
          JSON.stringify(input.availableSlots),
          'EXTRACTED_REQUIREMENTS',
          JSON.stringify(input.requirements),
          input.feedback ? `VALIDATION_FEEDBACK\n${input.feedback}` : '',
        ].join('\n'),
      });
      assertNoPriceFields(result.object);
      return result.object;
    }, signal);
  }
}
