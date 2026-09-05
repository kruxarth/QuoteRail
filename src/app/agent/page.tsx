import Image from 'next/image';
import { SiteToolsLive } from '@/components/site-tools-live';

export default function AgentPage() {
  return (
    <main>
      <section className="relative h-[42vh] min-h-[280px] overflow-hidden">
        <Image
          src="/venues/hall-hero.jpg"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] to-transparent" />
      </section>

      <div className="mx-auto max-w-2xl px-6 pt-4 pb-28">
        <p className="kicker text-[var(--accent)]">Purchasing agents</p>
        <h1 className="mt-6 font-serif text-5xl leading-[1.08]">
          Tell Mosaic what you need. No token.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-[var(--muted)]">
          Open this house in ChatGPT. Mosaic publishes WebMCP site tools in the tab — quote, accept,
          checkout. You approve the Razorpay deposit when a package is right.
        </p>
        <SiteToolsLive />

        <ol className="mt-16 space-y-12 border-t border-[var(--line)] pt-12">
          {[
            [
              '01',
              'Ask in ordinary language',
              'Date, people, dinner, a budget. With this page open, ChatGPT uses Mosaic’s site tools. Do not hunt for an API key — Mosaic will not ask your agent for one.',
            ],
            [
              '02',
              'Read the packages it brings back',
              'Two or three options, priced, with the room included. If the evening cannot be quoted safely, Mosaic stops instead of inventing a date.',
            ],
            [
              '03',
              'Pay forty percent on Razorpay',
              'The deposit holds the hall. Card details stay on Razorpay. Mosaic never takes them.',
            ],
          ].map(([n, title, copy]) => (
            <li key={n}>
              <p className="text-[11px] tracking-[0.22em] text-[var(--accent)]">{n}</p>
              <h2 className="mt-3 font-serif text-3xl">{title}</h2>
              <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
