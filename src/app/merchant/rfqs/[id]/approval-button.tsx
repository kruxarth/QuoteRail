'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function ApprovalButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <div className="mt-3 flex gap-2">
      <Button
        onClick={async () => {
          await fetch(`/api/merchant/approvals/${id}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ decision: 'approved' }),
          });
          router.refresh();
        }}
      >
        Approve
      </Button>
      <Button
        variant="danger"
        onClick={async () => {
          await fetch(`/api/merchant/approvals/${id}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ decision: 'rejected' }),
          });
          router.refresh();
        }}
      >
        Reject
      </Button>
    </div>
  );
}
