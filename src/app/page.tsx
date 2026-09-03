import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getEnv } from '@/env';

const halls = [
  {
    name: 'Grand Hall',
    image: '/venues/hall-grand.jpg',
    copy: 'Theatre for 180. Stage, launch lighting, the room for a keynote.',
    meta: '180 guests · from ₹80,000',
  },
  {
    name: 'Studio Hall',
    image: '/venues/hall-studio.jpg',
    copy: 'A closer 120-seat hall for analyst days and workshops.',
    meta: '120 guests · from ₹55,000',
  },
];

const services = [
  ['AV', 'LED wall or projector, PA, technician'],
  ['Dinner', 'Premium or standard buffet, Jain and vegan'],
  ['Valet', 'Crew covering up to 60 cars'],
  ['Stage', 'Branded dressing for the reveal'],
];

function siteOrigin(): string {
  const env = getEnv();
  return env.APP_BASE_URL.replace(/\/$/, '') || 'https://mosaic.example';
}

export default function HomePage() {
  const enquire = `${siteOrigin()}/api/enquire`;
  return (
    <main>
      <section className="relative isolate min-h-[88vh] overflow-hidden text-white">
        <Image
          src="/venues/hall-hero.jpg"
          alt="Mosaic Grand Hall"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#14110e]/88 via-[#14110e]/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#14110e]/50 via-transparent to-[#14110e]/20" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-6 pb-20 pt-32">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--accent)]">Indiranagar · Bengaluru</p>
          <h1 className="mt-5 max-w-3xl font-serif text-5xl font-normal leading-[1.08] md:text-6xl">
            The hall is ready.
            <br />
            Send the brief.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/80">
            Mosaic quotes launches the same afternoon — hall, AV, dinner, valet. Your agent books it. You pay the
            deposit on Razorpay.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/agent">Book with an agent</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/#halls">The rooms</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="halls" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">Two rooms</p>
        <h2 className="mt-3 max-w-xl font-serif text-4xl font-normal">Built for launches, not banquets.</h2>
        <div className="mt-14 grid gap-12 md:grid-cols-2">
          {halls.map((hall) => (
            <article key={hall.name}>
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src={hall.image} alt={hall.name} fill className="object-cover" sizes="(min-width: 768px) 50vw, 100vw" />
              </div>
              <h3 className="mt-6 font-serif text-3xl font-normal">{hall.name}</h3>
              <p className="mt-2 text-[var(--muted)]">{hall.copy}</p>
              <p className="mt-4 text-sm tracking-wide">{hall.meta}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2">
          <div className="relative min-h-80 overflow-hidden">
            <Image src="/venues/hall-dining.jpg" alt="Dinner service" fill className="object-cover" sizes="50vw" />
          </div>
          <div className="flex flex-col justify-center py-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">On the floor</p>
            <h2 className="mt-3 font-serif text-4xl font-normal">AV, dinner, valet, stage — with the hall.</h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {services.map(([name, detail]) => (
                <li key={name}>
                  <p className="text-sm font-medium tracking-wide">{name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">How companies book</p>
        <h2 className="mt-3 max-w-2xl font-serif text-4xl font-normal">Ask your agent. Approve the deposit.</h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-3">
          {[
            ['01', 'Send the brief', 'Date, people, dinner, budget — in ordinary language. No API token.'],
            ['02', 'Pick a package', 'Mosaic returns two or three options with live prices.'],
            ['03', 'Pay on Razorpay', 'Forty percent holds the room. Cards never pass through Mosaic.'],
          ].map(([n, title, copy]) => (
            <li key={n} className="border-t border-[var(--line)] pt-6">
              <p className="text-[11px] tracking-[0.2em] text-[var(--accent)]">{n}</p>
              <h3 className="mt-3 font-serif text-2xl font-normal">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="agents" className="border-t border-[var(--line)] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">Purchasing agents</p>
          <h2 className="mt-3 max-w-2xl font-serif text-4xl font-normal">No token. Post the brief.</h2>
          <p className="mt-4 max-w-xl text-[var(--muted)]">
            ChatGPT, OpenCode, or any client that can HTTP. Mosaic returns packages and a ticket for this conversation.
            Keep the ticket. The human pays on Razorpay.
          </p>
          <pre className="mt-10 overflow-auto border border-[var(--line)] bg-[var(--background)] p-6 text-sm leading-relaxed">
            {`POST ${enquire}
Content-Type: application/json

{ "request": "Friday next week, 80 people, Bangalore, dinner, under 2 lakhs" }`}
          </pre>
          <p className="mt-6 text-sm text-[var(--muted)]">
            Contract:{' '}
            <Link href="/.well-known/agent-commerce.json" className="underline underline-offset-4">
              /.well-known/agent-commerce.json
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
