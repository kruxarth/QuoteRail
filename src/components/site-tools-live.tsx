'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function SiteToolsLive({ className }: { className?: string }) {
  const [live, setLive] = useState(false);

  useEffect(() => {
    const sync = () => setLive(document.documentElement.dataset.webmcp === 'ready');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-webmcp'],
    });
    return () => observer.disconnect();
  }, []);

  if (!live) return null;
  return (
    <p className={cn('kicker mt-8 text-[var(--accent)]', className)}>
      WebMCP site tools · live in this tab
    </p>
  );
}
