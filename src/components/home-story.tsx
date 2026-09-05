'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const TAGLINE = 'AI-agent first booking hall, now in your city.';

const ROOMS = [
  {
    name: 'Grand Hall',
    image: '/venues/hall-grand.jpg',
    copy: 'One hundred and eighty. A stage, a keynote, the lights down.',
    meta: '180 guests · from ₹80,000',
  },
  {
    name: 'Studio Hall',
    image: '/venues/hall-studio.jpg',
    copy: 'Closer. One hundred and twenty. Analyst mornings, the working session.',
    meta: '120 guests · from ₹55,000',
  },
] as const;

const FILM = [
  { src: '/venues/hall-hero.jpg', caption: 'The house' },
  { src: '/venues/hall-grand.jpg', caption: 'Grand Hall' },
  { src: '/venues/hall-studio.jpg', caption: 'Studio Hall' },
  { src: '/venues/hall-dining.jpg', caption: 'After the keynote' },
] as const;

const SERVICES = [
  ['AV', 'LED wall or projector, PA, a technician in the room'],
  ['Dinner', 'Premium or standard buffet. Jain and vegan without fuss'],
  ['Valet', 'A crew covering up to sixty cars'],
  ['Stage', 'Branded dressing for the reveal'],
] as const;

const RITUAL = [
  {
    n: '01',
    title: 'Ask your agent',
    copy: 'Open Mosaic in ChatGPT. Tell it Indiranagar, the date, the people. The tab already has the booking tools.',
  },
  {
    n: '02',
    title: 'It quotes the night',
    copy: 'Two or three packages come back the same afternoon. Live prices. The room included. No API token.',
  },
  {
    n: '03',
    title: 'You pay the deposit',
    copy: 'Forty percent on Razorpay holds the evening. Cards never pass through this house.',
  },
] as const;

function pinnedProgress(el: HTMLElement) {
  const total = el.offsetHeight - window.innerHeight;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total));
}

function onRafScroll(frame: () => void) {
  let raf = 0;
  const tick = () => {
    raf = 0;
    frame();
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
}

export function HomeStory() {
  return (
    <main>
      <ScrollProgress />
      <Hero />
      <Interlude />
      <Filmstrip />
      <RoomsChapter />
      <FloorChapter />
      <RitualChapter />
      <CloseChapter />
    </main>
  );
}

function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    return onRafScroll(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    });
  }, []);

  return (
    <div
      ref={bar}
      className="pointer-events-none fixed top-0 right-0 left-0 z-[60] h-[2px] origin-left bg-[var(--foreground)]"
      style={{ transform: 'scaleX(0)' }}
    />
  );
}

function Hero() {
  const photo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = photo.current;
    if (!wrap) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    return onRafScroll(() => {
      const y = window.scrollY;
      if (y > window.innerHeight * 1.2) return;
      wrap.style.transform = `translate3d(0, ${y * 0.22}px, 0) scale(${1.08 + y * 0.00008})`;
    });
  }, []);

  return (
    <section id="hero" data-header="ink" className="relative h-svh min-h-[640px] overflow-hidden">
      <div ref={photo} className="hero-photo absolute inset-0 will-change-transform">
        <Image
          src="/venues/hall-hero.jpg"
          alt="Mosaic Grand Hall, Indiranagar"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#f0eeeb] via-[#f0eeeb]/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-20 md:px-16 md:pb-24">
        <p className="kicker text-[var(--accent)]">Mosaic Events · Indiranagar</p>
        <h1 className="mt-5 max-w-5xl font-serif text-4xl leading-[1.06] md:text-7xl">{TAGLINE}</h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-[var(--accent)] md:text-lg">
          Two rooms on 100 Feet Road. Your agent books. You hold the evening on Razorpay.
        </p>
        <Link href="/agent" className="pill mt-10 bg-[var(--foreground)] text-[var(--background)]">
          How to book
        </Link>
      </div>
      <p className="absolute right-6 bottom-20 hidden text-[10px] tracking-[0.28em] text-[var(--accent)] uppercase md:right-12 md:block">
        Scroll
        <span className="scroll-hint-line mt-3 ml-1 inline-block h-10 w-px bg-[var(--foreground)] align-top" />
      </p>
    </section>
  );
}

function Interlude() {
  return (
    <section data-header="light" className="mx-auto max-w-4xl px-6 py-32 text-center md:py-44">
      <p className="story-reveal font-serif text-3xl leading-snug text-balance md:text-6xl">
        Not a form. Not a phone tree.
        <br />
        Your agent already speaks the house.
      </p>
    </section>
  );
}

function Filmstrip() {
  const scene = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLParagraphElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const sceneEl = scene.current;
    const trackEl = track.current;
    if (!sceneEl || !trackEl) return;
    return onRafScroll(() => {
      const p = pinnedProgress(sceneEl);
      const max = Math.max(0, trackEl.scrollWidth - window.innerWidth);
      trackEl.style.transform = `translate3d(${-max * p}px, 0, 0)`;
      const next = Math.min(FILM.length - 1, Math.floor(p * FILM.length + 0.001));
      setActive((prev) => (prev === next ? prev : next));
      if (caption.current) {
        caption.current.style.opacity = String(0.35 + (p % (1 / FILM.length)) * 0.65);
      }
    });
  }, []);

  return (
    <section ref={scene} data-header="dark" className="pin-scene relative h-[280vh]">
      <div className="pin-sticky sticky top-0 h-svh overflow-hidden bg-black">
        <div ref={track} className="film-track flex h-full will-change-transform">
          {FILM.map((frame) => (
            <figure key={frame.src} className="relative h-full w-[78vw] shrink-0 md:w-[72vw]">
              <Image
                src={frame.src}
                alt={frame.caption}
                fill
                className="object-cover"
                sizes="80vw"
              />
            </figure>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />
        <p
          ref={caption}
          className="absolute bottom-16 left-6 font-serif text-4xl text-white md:left-16 md:text-6xl"
        >
          {FILM[active]?.caption}
        </p>
      </div>
    </section>
  );
}

function RoomsChapter() {
  const scene = useRef<HTMLElement>(null);
  const grand = useRef<HTMLDivElement>(null);
  const studio = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const [studioActive, setStudioActive] = useState(false);

  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    return onRafScroll(() => {
      const p = pinnedProgress(el);
      const t = p < 0.36 ? 0 : p > 0.58 ? 1 : (p - 0.36) / 0.22;
      if (grand.current) {
        grand.current.style.opacity = String(1 - t);
        grand.current.style.transform = `scale(${1.12 - t * 0.08})`;
      }
      if (studio.current) {
        studio.current.style.opacity = String(t);
        studio.current.style.transform = `scale(${1.04 + t * 0.08})`;
      }
      if (copy.current) {
        copy.current.style.transform = `translate3d(0, ${(0.5 - t) * 24}px, 0)`;
      }
      const next = t > 0.5;
      setStudioActive((prev) => (prev === next ? prev : next));
    });
  }, []);

  const room = studioActive ? ROOMS[1] : ROOMS[0];

  return (
    <section id="halls" ref={scene} data-header="dark" className="pin-scene relative h-[280vh]">
      <div className="pin-sticky sticky top-0 h-svh overflow-hidden bg-black">
        <div className="pin-stack absolute inset-0">
          <div ref={grand} className="pin-layer absolute inset-0 will-change-transform">
            <Image
              src={ROOMS[0].image}
              alt={ROOMS[0].name}
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
          <div ref={studio} className="pin-layer absolute inset-0 opacity-0 will-change-transform">
            <Image
              src={ROOMS[1].image}
              alt={ROOMS[1].name}
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
        <div
          ref={copy}
          className="pin-copy absolute inset-x-0 bottom-0 px-6 pb-16 text-white will-change-transform md:px-16 md:pb-20"
        >
          <p className="kicker text-white/70">The rooms</p>
          <h2 className="mt-4 font-serif text-4xl md:text-6xl">{room.name}</h2>
          <p className="sr-only">
            Grand Hall and Studio Hall. {ROOMS[0].copy} {ROOMS[1].copy}
          </p>
          <p className="pin-copy-muted mt-4 max-w-lg text-base leading-relaxed text-white/75">
            {room.copy}
          </p>
          <p className="mt-6 text-sm tracking-wide text-white/80">{room.meta}</p>
          <p className="mt-8 text-[11px] tracking-[0.22em] text-white/45 uppercase">
            Grand Hall · Studio Hall
          </p>
        </div>
      </div>
    </section>
  );
}

function FloorChapter() {
  return (
    <section data-header="dark" className="relative min-h-[100svh] overflow-hidden">
      <Image
        src="/venues/hall-dining.jpg"
        alt="Dinner service at Mosaic"
        fill
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative mx-auto flex min-h-[100svh] max-w-[1400px] flex-col justify-end px-6 py-24 text-white md:px-16">
        <p className="story-reveal kicker text-white/70">The floor</p>
        <h2 className="story-reveal mt-4 max-w-2xl font-serif text-4xl md:text-6xl">
          Dinner is dressed with the hall.
        </h2>
        <ul className="story-reveal mt-14 grid max-w-3xl gap-8 sm:grid-cols-2">
          {SERVICES.map(([name, detail]) => (
            <li key={name}>
              <p className="text-sm tracking-[0.14em] uppercase">{name}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RitualChapter() {
  const scene = useRef<HTMLElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    return onRafScroll(() => {
      const p = pinnedProgress(el);
      if (fill.current) fill.current.style.transform = `scaleY(${p})`;
      const next = p < 0.28 ? 0 : p < 0.62 ? 1 : 2;
      setStep((prev) => (prev === next ? prev : next));
    });
  }, []);

  const current = RITUAL[step];

  return (
    <section
      ref={scene}
      data-header="light"
      className="pin-scene relative h-[320vh] bg-[var(--parchment-warm)]"
    >
      <div className="pin-sticky sticky top-0 flex h-svh items-center overflow-hidden">
        <p className="ritual-watermark pointer-events-none absolute right-[-4vw] bottom-[-8vh] font-serif text-[42vw] leading-none text-black/[0.06] select-none md:text-[22rem]">
          {current.n}
        </p>
        <div className="relative mx-auto flex w-full max-w-[1400px] items-end gap-16 px-6 md:px-16">
          <div className="hidden h-[46vh] w-px bg-[var(--line)] md:block">
            <div
              ref={fill}
              className="h-full origin-top bg-[var(--foreground)]"
              style={{ transform: 'scaleY(0)' }}
            />
          </div>
          <div className="max-w-2xl pb-8">
            <p className="kicker text-[var(--accent)]">How the house is booked</p>
            <div key={current.n} className="ritual-step mt-8 min-h-[240px]">
              <p className="text-sm tracking-[0.2em] text-[var(--accent)]">{current.n}</p>
              <h2 className="mt-4 font-serif text-5xl md:text-7xl">{current.title}</h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--muted)]">
                {current.copy}
              </p>
            </div>
            <ol className="mt-16 flex flex-wrap gap-8 text-[11px] tracking-[0.22em] text-[var(--muted)] uppercase">
              {RITUAL.map((item, i) => (
                <li key={item.n} className={i === step ? 'text-[var(--foreground)]' : undefined}>
                  {item.n} {item.title}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function CloseChapter() {
  return (
    <section id="agents" data-header="light" className="bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-6 py-32 text-center md:py-44">
        <p className="story-reveal kicker text-[var(--accent)]">Bengaluru</p>
        <h2 className="story-reveal mt-6 font-serif text-4xl leading-tight md:text-6xl">
          {TAGLINE}
        </h2>
        <p className="story-reveal mx-auto mt-6 max-w-md text-base leading-relaxed text-[var(--muted)]">
          Open this house in ChatGPT. Mosaic’s booking tools appear in the tab. You approve the
          deposit. That is the whole motion.
        </p>
        <Link
          href="/agent"
          className="pill story-reveal mt-12 bg-[var(--foreground)] text-[var(--background)]"
        >
          How to book
        </Link>
      </div>
    </section>
  );
}
