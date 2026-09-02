import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const halls = [
  {
    name: 'Grand Hall',
    image: '/venues/hall-grand.jpg',
    copy: 'Theatre for 180, full stage, product-launch lighting. The room for keynotes and unveilings.',
    meta: '180 guests · six-hour slots from ₹80,000',
  },
  {
    name: 'Studio Hall',
    image: '/venues/hall-studio.jpg',
    copy: 'A tighter 120-seat hall for focused launches, analyst briefings, and workshops.',
    meta: '120 guests · six-hour slots from ₹55,000',
  },
];

const services = [
  ['AV', 'LED wall or projector, PA, technician'],
  ['Dinner', 'Premium or standard buffet, Jain and vegan'],
  ['Valet', 'Crew covering up to 60 cars'],
  ['Stage', 'Branded dressing for the reveal'],
];

export default function HomePage() {
  return (
    <main>
      <section className="relative isolate min-h-[78vh] overflow-hidden text-white">
        <Image
          src="/venues/hall-hero.jpg"
          alt="Mosaic Grand Hall set for a launch"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1c1914]/90 via-[#1c1914]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1914]/55 via-transparent to-[#1c1914]/10" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-6 pb-16 pt-28">
          <p className="text-sm uppercase tracking-[0.28em] text-amber-100/90">Indiranagar · Bengaluru</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[1.05] md:text-7xl">
            The hall is ready. Send the brief.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-amber-50/90">
            Mosaic quotes launches the same afternoon: hall, AV, dinner, valet. Your purchasing agent books it. Deposit
            on Razorpay.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/agent">Book with your agent</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/#halls">See the halls</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="halls" className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Two rooms</p>
        <h2 className="mt-2 max-w-2xl font-serif text-4xl">Built for product launches, not weddings.</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {halls.map((hall) => (
            <article key={hall.name} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              <div className="relative aspect-[4/3]">
                <Image src={hall.image} alt={hall.name} fill className="object-cover" sizes="(min-width: 768px) 50vw, 100vw" />
              </div>
              <div className="p-6">
                <h3 className="font-serif text-3xl">{hall.name}</h3>
                <p className="mt-2 text-[var(--muted)]">{hall.copy}</p>
                <p className="mt-4 text-sm font-medium">{hall.meta}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2">
          <div className="relative min-h-72 overflow-hidden rounded-2xl">
            <Image src="/venues/hall-dining.jpg" alt="Dinner service" fill className="object-cover" sizes="50vw" />
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">On the floor</p>
            <h2 className="mt-2 font-serif text-4xl">AV, dinner, valet, stage — priced with the hall.</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {services.map(([name, detail]) => (
                <li key={name}>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-[var(--muted)]">{detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">How companies book</p>
        <h2 className="mt-2 max-w-2xl font-serif text-4xl">Your agent talks to Mosaic. You approve the deposit.</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ['1', 'Send the brief', 'Date, headcount, AV, dinner, budget. From OpenCode or any purchasing agent.'],
            ['2', 'Pick a package', 'Mosaic returns two or three options with live prices. No invented totals.'],
            ['3', 'Pay on Razorpay', '40% deposit holds the room. Card details never pass through Mosaic.'],
          ].map(([n, title, copy]) => (
            <li key={n} className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <p className="font-serif text-3xl text-[var(--accent)]">{n}</p>
              <h3 className="mt-3 font-serif text-2xl">{title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{copy}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Button asChild>
            <Link href="/agent">Connect your agent</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
