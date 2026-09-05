'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type HeaderTone = 'ink' | 'light' | 'dark';

export function SiteHeader() {
  const pathname = usePathname();
  const home = pathname === '/';
  const [homeTone, setHomeTone] = useState<HeaderTone>('ink');
  const tone = home ? homeTone : 'light';

  useEffect(() => {
    if (!home) return;

    let raf = 0;
    const tick = () => {
      raf = 0;
      const sections = document.querySelectorAll<HTMLElement>('[data-header]');
      let next: HeaderTone | null = null;
      for (const el of sections) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 64 && rect.bottom > 64) {
          const value = el.dataset.header;
          if (value === 'ink' || value === 'light' || value === 'dark') {
            next = value;
            break;
          }
        }
      }
      if (next) setHomeTone((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    tick();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [home]);

  return (
    <header
      className={cn(
        'z-50 transition-[background-color,border-color,color] duration-500',
        home ? 'fixed inset-x-0 top-0' : 'sticky top-0',
        tone === 'light' &&
          'border-b border-[var(--line)] bg-[var(--background)]/92 text-[var(--foreground)] backdrop-blur-md',
        tone === 'ink' &&
          'border-b border-transparent bg-transparent text-[var(--foreground)] [text-shadow:0_1px_16px_rgba(240,238,235,0.95)]',
        tone === 'dark' && 'border-b border-white/10 bg-black/20 text-white backdrop-blur-sm',
      )}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 md:px-10">
        <Link href="/" className="font-serif text-[1.35rem] tracking-[0.01em]">
          Mosaic
        </Link>
        <nav
          className={cn(
            'flex items-center gap-4 text-[10px] tracking-[0.18em] uppercase sm:gap-7 sm:text-[11px] sm:tracking-[0.2em]',
            tone === 'dark' ? 'text-white/70' : 'text-[var(--accent)]',
          )}
        >
          <Link
            href="/#halls"
            className={tone === 'dark' ? 'hover:text-white' : 'hover:text-[var(--foreground)]'}
          >
            Rooms
          </Link>
          <Link
            href="/agent"
            className={tone === 'dark' ? 'hover:text-white' : 'hover:text-[var(--foreground)]'}
          >
            Agents
          </Link>
          <Link
            href="/merchant"
            className={tone === 'dark' ? 'hover:text-white' : 'hover:text-[var(--foreground)]'}
          >
            Staff
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/merchant')) return null;

  return (
    <footer className="mt-auto bg-[var(--foreground)] text-[var(--background)]">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-6 py-20 md:grid-cols-3 md:px-10">
        <div>
          <p className="font-serif text-3xl">Mosaic Events</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            A private venue in Indiranagar for product launches and closed-door briefings.
          </p>
        </div>
        <div className="text-sm leading-7 text-white/55">
          <p>14/2, 100 Feet Road</p>
          <p>Indiranagar, Bengaluru 560038</p>
          <p className="mt-4">bookings@mosaicevents.in</p>
        </div>
        <div className="text-sm leading-7 text-white/55">
          <p>Deposits on Razorpay.</p>
          <p>Forty-eight hours’ notice, including setup.</p>
          <p className="mt-4">
            <Link href="/agent" className="underline decoration-white/25 underline-offset-4">
              How to book
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
