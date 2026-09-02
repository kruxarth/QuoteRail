'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function DemoReset() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await fetch('/api/merchant/reset', { method: 'POST' });
        router.refresh();
      }}
    >
      Reset calendar
    </Button>
  );
}
