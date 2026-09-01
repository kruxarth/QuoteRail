import { getEnv, fakeAiEnabled } from '@/env';
import { FakeModelAdapter } from '@/server/planner/fake';
import { OpenCodeGoAdapter } from '@/server/planner/opencode-go';
import type { ModelAdapter } from '@/server/planner/types';

export function createModelAdapter(): ModelAdapter {
  if (fakeAiEnabled(getEnv())) return new FakeModelAdapter();
  return new OpenCodeGoAdapter();
}
