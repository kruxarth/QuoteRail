'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyRfq({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-sm">{text}</p>
      <Button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        }}
      >
        {copied ? 'Copied' : 'Copy demo RFQ'}
      </Button>
    </div>
  );
}
