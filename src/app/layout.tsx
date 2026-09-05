import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cardo, DM_Sans, Geist_Mono } from 'next/font/google';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { WebMcpRoot } from '@/components/webmcp-root';
import './globals.css';

const body = DM_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500'],
});

const display = Cardo({
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
  description:
    'AI-agent first booking hall, now in your city. Open Mosaic in ChatGPT. Mosaic Events, Indiranagar.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <WebMcpRoot />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
