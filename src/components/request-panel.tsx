export function RequestPanel({
  raw,
  sanitized,
  requirements,
}: {
  raw: string;
  sanitized: string;
  requirements: unknown;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Incoming request</h3>
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3">{sanitized || raw}</p>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted constraints</h3>
        <pre className="mt-2 overflow-auto rounded-md bg-slate-50 p-3 text-xs">
          {JSON.stringify(requirements, null, 2)}
        </pre>
      </div>
    </div>
  );
}
