import { Badge } from '@/components/ui/badge';

export function PolicyVerdict({
  rules,
  merchant = false,
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
}) {
  if (!rules.length) return <p className="text-sm text-slate-500">No policy evaluation yet.</p>;
  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <div key={rule.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs">{rule.id}</span>
            <Badge tone={rule.passed ? 'ok' : rule.severity === 'approval' ? 'warn' : 'danger'}>
              {rule.passed ? 'passed' : rule.severity === 'approval' ? 'approval' : 'blocked'}
            </Badge>
          </div>
          <p className="mt-1 text-sm">{rule.reason}</p>
          {merchant && (
            <p className="mt-1 text-xs text-slate-500">
              observed {rule.observed} · limit {rule.limit}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
