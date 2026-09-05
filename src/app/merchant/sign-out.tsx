'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function MerchantSignOut() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await fetch('/api/merchant/logout', { method: 'POST' });
        router.push('/merchant/login');
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
