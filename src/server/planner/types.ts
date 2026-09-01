import type { CandidateSet, ExtractedRequirements } from '@/shared/schemas';
import type { Clock } from '@/shared/clock';

export type PlannerOfferingSummary = {
  code: string;
  name: string;
  category: string;
  capacityUnits: number | null;
  capabilities: string[];
};

export type ModelAdapter = {
  extract(input: {
    request: string;
    clock: Clock;
    history?: string[];
    signal?: AbortSignal;
  }): Promise<ExtractedRequirements>;
  plan(input: {
    requirements: ExtractedRequirements;
    offerings: PlannerOfferingSummary[];
    availableSlots: Array<{ code: string; date: string; window: string; available: boolean }>;
    feedback?: string;
    clock: Clock;
    signal?: AbortSignal;
  }): Promise<CandidateSet>;
};
