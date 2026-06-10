import type { Metadata, Viewport } from 'next';
import { Nav } from '@/components/nav';
import './globals.css';

// viewport-fit=cover lets the mobile tab bar extend behind the iOS home
// indicator while its safe-area padding keeps the targets clear of it.
export const viewport: Viewport = {
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: {
    default: 'Haazri — camera-verified labour ledger',
    template: '%s · Haazri',
  },
  description:
    'Camera-verified labour-day ranges, a hash-chained daily ledger, and weekly contractor bill reconciliation for Indian builders.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* App Router root layout: fonts load for every page — rule targets pages/_document. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
          precedence="default"
        />
      </head>
      <body className="min-h-full">
        <Nav />
        <main className="mx-auto w-full max-w-[1080px] px-6 py-10 pb-28 sm:pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
