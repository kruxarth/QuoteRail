'use client';

import { useEffect, useState } from 'react';

export function SiteToolsLive() {
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
  return <p className="kicker mt-8 text-[var(--accent)]">WebMCP site tools · live in this tab</p>;
}
