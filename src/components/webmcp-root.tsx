'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const WebMcpBooking = dynamic(() => import('@/components/webmcp-booking'), { ssr: false });

export function WebMcpRoot() {
  const pathname = usePathname();
  if (pathname.startsWith('/merchant')) return null;
  return <WebMcpBooking />;
}
