import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main>
      <section className="bg-[var(--brand)] text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-100">Bengaluru · Corporate venues</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
            Mosaic Events turns complex enquiries into reservable, policy-compliant packages.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-emerald-50">
            Grand Hall and Studio Hall, catering, AV, valet, and staging — quoted by QuoteRail, paid on Razorpay.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild>
              <Link href="/agent">Shop with your AI agent</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/merchant/login">Merchant console</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Grand Hall</CardTitle>
          </CardHeader>
          <CardContent>
            Theatre seating for 180, stage, product-launch lighting, accessible. Six-hour slots from ₹80,000.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Studio Hall</CardTitle>
          </CardHeader>
          <CardContent>
            Compact 120-guest hall for focused launches and workshops. Six-hour slots from ₹55,000.
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
