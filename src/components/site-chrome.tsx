import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--background)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-[1.65rem] font-normal tracking-tight text-[var(--brand)]">
          Mosaic
        </Link>
        <nav className="flex items-center gap-8 text-[13px] tracking-wide text-[var(--muted)]">
          <Link href="/#halls" className="hover:text-[var(--foreground)]">
            Halls
          </Link>
          <Link href="/agent" className="hover:text-[var(--foreground)]">
            For agents
          </Link>
          <Link href="/merchant" className="hover:text-[var(--foreground)]">
            Staff
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-[var(--brand)] text-[#f6f1ea]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
        <div>
          <p className="font-serif text-3xl font-normal">Mosaic Events</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-emerald-100/75">
            A private venue in Indiranagar for product launches and closed-door briefings.
          </p>
        </div>
        <div className="text-sm leading-7 text-emerald-100/75">
          <p>14/2, 100 Feet Road</p>
          <p>Indiranagar, Bengaluru 560038</p>
          <p className="mt-3">bookings@mosaicevents.in</p>
        </div>
        <div className="text-sm leading-7 text-emerald-100/75">
          <p>Deposits on Razorpay.</p>
          <p>Forty-eight hours’ notice, including setup.</p>
          <p className="mt-3">
            <Link href="/.well-known/agent-commerce.json" className="underline decoration-white/30 underline-offset-4">
              Agent contract
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
