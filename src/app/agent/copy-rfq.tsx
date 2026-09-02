'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyRfq({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap rounded-xl bg-[var(--background)] p-4 text-sm text-[var(--foreground)]">{text}</p>
      <Button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        }}
      >
        {copied ? 'Copied' : 'Copy brief'}
      </Button>
    </div>
  );
}
