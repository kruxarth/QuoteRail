import { Badge } from '@/components/ui/badge';
import { ruleLabel } from '@/server/quotes/rfq-story';

export function PolicyVerdict({
  rules,
  merchant = false,
  emptyHint,
}: {
  rules: Array<{
    id: string;
    passed: boolean;
    severity?: string;
    observed?: string;
    limit?: string;
    reason: string;
  }>;
  merchant?: boolean;
  emptyHint?: string;
}) {
  if (!rules.length) {
    return (
      <p className="text-sm text-slate-500">
        {emptyHint ?? 'No package made it far enough to save a policy snapshot.'}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <div key={rule.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{ruleLabel(rule.id)}</span>
            <Badge tone={rule.passed ? 'ok' : rule.severity === 'approval' ? 'warn' : 'danger'}>
              {rule.passed ? 'passed' : rule.severity === 'approval' ? 'needs approval' : 'blocked'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-700">{rule.reason}</p>
          {merchant && (rule.observed || rule.limit) ? (
            <p className="mt-1 text-xs text-slate-500">
              observed {rule.observed ?? '—'} · limit {rule.limit ?? '—'}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
