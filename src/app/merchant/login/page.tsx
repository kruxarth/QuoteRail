'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function MerchantLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-24">
      <p className="kicker text-[var(--accent)]">Staff</p>
      <h1 className="mt-4 font-serif text-4xl">Staff sign-in</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        The floor board — enquiries, decisions, slots.
      </p>
      <form
        className="mt-10 space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const response = await fetch('/api/merchant/login', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ password }),
            });
            if (!response.ok) {
              setError('Login failed');
              return;
            }
            router.push('/merchant');
            router.refresh();
          } catch {
            setError('Login failed');
          }
        }}
      >
        <label className="block text-sm">
          Password
          <Input
            className="mt-2 rounded-none border-[var(--line)] bg-[var(--parchment-warm)]"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">Sign in</Button>
      </form>
    </main>
  );
}
