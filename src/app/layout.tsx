import type { Metadata } from 'next';
import { Open_Sans, Sora } from 'next/font/google';
import './globals.css';
import { SanctuaryShell } from '@/components/shell';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Sora is a variable font — one file covers the whole weight axis.
const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Voyo',
  description: 'Talk it out. A warm AI voice helps you debrief your day — speak or type, and be heard.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${sora.variable} h-full antialiased`}
    >
      {/* Height-locked app shell: the document never scrolls; each page
          region owns its scrolling (see shell.tsx). */}
      <body className="flex h-dvh flex-col overflow-hidden">
        <SanctuaryShell>{children}</SanctuaryShell>
      </body>
    </html>
  );
}
