import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Figtree, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import './globals.css';

const body = Figtree({
  variable: '--font-body',
  subsets: ['latin'],
});

const display = Instrument_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Mosaic Events · Bengaluru',
  description: 'Grand Hall and Studio Hall in Indiranagar. Corporate launches, quoted in minutes, paid on Razorpay.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
