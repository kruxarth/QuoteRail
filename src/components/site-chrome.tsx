import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--background)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight text-[var(--brand)]">
          Mosaic Events
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/#halls" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Halls
          </Link>
          <Link href="/agent" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Book with an agent
          </Link>
          <Link href="/merchant" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Staff
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[#1f3d32] text-[#f4efe6]">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-3">
        <div>
          <p className="font-semibold tracking-tight text-2xl">Mosaic Events</p>
          <p className="mt-2 text-sm text-emerald-100/80">Corporate venues in Indiranagar, Bengaluru.</p>
        </div>
        <div className="text-sm leading-relaxed text-emerald-100/80">
          <p>14/2, 100 Feet Road</p>
          <p>Indiranagar, Bengaluru 560038</p>
          <p className="mt-2">bookings@mosaicevents.in</p>
        </div>
        <div className="text-sm text-emerald-100/80">
          <p>Deposits on Razorpay.</p>
          <p className="mt-2">48-hour lead, including setup.</p>
        </div>
      </div>
    </footer>
  );
}
