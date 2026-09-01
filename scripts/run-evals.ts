import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { db, sql } from '@/db/client';
import { FrozenClock } from '@/shared/clock';
import { FROZEN_TEST_NOW, SELLER_MODEL, EXTRACTION_PROMPT_VERSION, PLANNER_PROMPT_VERSION } from '@/shared/constants';
import { resetDemo } from '@/server/catalog/seed';
import { requestQuote } from '@/server/quotes/rfq-service';
import { createModelAdapter } from '@/server/planner/adapter';

type Case = {
  id: string;
  category: string;
  request: string;
  clarification_required: boolean;
  feasible: boolean;
  expected_security: string;
  required_relaxation?: string;
};

async function main() {
  const clock = new FrozenClock(new Date(FROZEN_TEST_NOW));
  await resetDemo(db, clock);
  const adapter = createModelAdapter();
  const lines = readFileSync('evals/rfqs.jsonl', 'utf8').trim().split('\n');
  const cases: Case[] = lines.map((line) => JSON.parse(line));
  const results = [];
  const started = Date.now();
  for (const testCase of cases) {
    const t0 = Date.now();
    try {
      const out = await requestQuote({
        buyerSubject: `eval:${testCase.id}`,
        request: testCase.request,
        clock,
        adapter,
      });
      const clarificationOk = testCase.clarification_required
        ? out.status === 'needs_clarification'
        : out.status !== 'needs_clarification' || testCase.feasible;
      const feasibleOk = testCase.feasible
        ? out.status === 'quoted' || out.status === 'needs_clarification'
        : out.status === 'escalated' || out.status === 'needs_clarification' || out.status === 'quoted';
      const blockedDiscount =
        testCase.expected_security === 'block_discount'
          ? (out.options ?? []).every((o) => Number(o.total_price) >= 5_000_000)
          : true;
      results.push({
        id: testCase.id,
        category: testCase.category,
        status: out.status,
        option_count: out.options?.length ?? 0,
        latency_ms: Date.now() - t0,
        clarificationOk,
        feasibleOk,
        blockedDiscount,
        error: null,
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        category: testCase.category,
        status: 'error',
        option_count: 0,
        latency_ms: Date.now() - t0,
        clarificationOk: false,
        feasibleOk: false,
        blockedDiscount: false,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
  const latencies = results.map((r) => r.latency_ms).sort((a, b) => a - b);
  const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0;
  const report = {
    model: SELLER_MODEL,
    prompt_versions: { extraction: EXTRACTION_PROMPT_VERSION, planner: PLANNER_PROMPT_VERSION },
    generated_at: new Date().toISOString(),
    case_count: cases.length,
    elapsed_ms: Date.now() - started,
    p95_latency_ms: p95,
    results,
  };
  mkdirSync('evals/expected', { recursive: true });
  writeFileSync('evals/expected/last-run.json', JSON.stringify(report, null, 2));
  const md = [
    '# Eval report',
    '',
    `- Adapter: ${process.env.FAKE_AI === 'true' || !process.env.OPENCODE_GO_API_KEY ? 'fake planner' : 'OpenCode Go'}`,
    `- Model: ${report.model}`,
    `- Prompt versions: ${EXTRACTION_PROMPT_VERSION} / ${PLANNER_PROMPT_VERSION}`,
    `- Cases: ${report.case_count}`,
    `- p95 latency: ${report.p95_latency_ms} ms`,
    `- Errors: ${results.filter((r) => r.error).length}`,
    '',
    'Live model evals are opt-in. This committed report is from the fake adapter unless an OpenCode Go key was present.',
    '',
    '| ID | status | options | latency |',
    '|---|---|---:|---:|',
    ...results.map((r) => `| ${r.id} | ${r.status} | ${r.option_count} | ${r.latency_ms} |`),
  ].join('\n');
  writeFileSync('docs/EVALS.md', md);
  console.log(md);
  await sql.end({ timeout: 1 });
}

main().catch(async (error) => {
  console.error(error);
  await sql.end({ timeout: 1 });
  process.exit(1);
});
