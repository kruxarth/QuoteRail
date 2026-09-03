import { headers } from 'next/headers';
import { SystemClock } from '@/shared/clock';
import { demoDates } from '@/server/availability/slots';
import { getEnv } from '@/env';
import { CopyRfq } from '@/app/agent/copy-rfq';

export default async function AgentPage() {
  const env = getEnv();
  const dates = demoDates(new SystemClock());
  const host = (await headers()).get('host') ?? 'localhost:3000';
  const proto = env.APP_BASE_URL.startsWith('https') ? 'https' : 'http';
  const origin = env.APP_BASE_URL || `${proto}://${host}`;
  const enquireUrl = `${origin.replace(/\/$/, '')}/api/enquire`;
  const rfq = `Can you check Mosaic Events in Bangalore? Not this Friday — Friday next week, the ${dates.friday.slice(8)}, evening, about six hours. Around 80 people, small product thing for the team. Dinner, maybe 10 Jain and 10 vegan, a screen and speakers is enough, no valet. Try to keep it under 2 lakhs. We can pay a deposit.`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">Purchasing agents</p>
      <h1 className="mt-4 font-serif text-5xl font-normal leading-tight">Tell Mosaic what you need. No token.</h1>
      <p className="mt-6 text-lg leading-relaxed text-[var(--muted)]">
        Post a brief to the enquire URL. Mosaic returns packages and a ticket for this conversation. Give the human the
        Razorpay link when it is time to pay.
      </p>

      <section className="mt-14 border-t border-[var(--line)] pt-10">
        <h2 className="font-serif text-2xl font-normal">Enquire</h2>
        <pre className="mt-4 overflow-auto bg-white p-5 text-sm leading-relaxed ring-1 ring-[var(--line)]">
          {`POST ${enquireUrl}
Content-Type: application/json

{ "request": "<natural language brief>" }`}
        </pre>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Contract{' '}
          <a className="underline underline-offset-4" href="/.well-known/agent-commerce.json">
            /.well-known/agent-commerce.json
          </a>
        </p>
      </section>

      <section className="mt-12 border-t border-[var(--line)] pt-10">
        <h2 className="font-serif text-2xl font-normal">A brief that works</h2>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Friday {dates.friday}, eighty guests, under two lakhs. Copy it into ChatGPT and point it at Mosaic.
        </p>
        <div className="mt-6">
          <CopyRfq text={rfq} />
        </div>
      </section>
    </main>
  );
}
