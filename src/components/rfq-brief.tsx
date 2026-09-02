import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requirementFacts } from '@/server/quotes/rfq-story';

export function RfqBrief({
  raw,
  sanitized,
  requirements,
}: {
  raw: string;
  sanitized: string;
  requirements: unknown;
}) {
  const facts = requirementFacts(requirements);
  return (
    <Card>
      <CardHeader>
        <CardTitle>What the buyer asked</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{sanitized || raw}</p>
        {facts.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{fact.label}</dt>
                <dd className="mt-1">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-slate-500">Requirements have not been extracted yet.</p>
        )}
        {requirements ? (
          <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-600">Raw extracted JSON</summary>
            <pre className="mt-2 overflow-auto text-xs text-slate-600">{JSON.stringify(requirements, null, 2)}</pre>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
