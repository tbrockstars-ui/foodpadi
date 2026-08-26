import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// Self-hosted by Next.js at build time (no runtime request to Google) —
// a free-license geometric sans chosen for a similar friendly, confident
// feel to what we noticed on Samsung Food's site, without using their
// actual (proprietary, non-licensable) SamsungOne/SamsungSharpSans fonts.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'FoodPadi — your food companion',
  description: 'Your food companion that plans with you, not for you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={plusJakartaSans.variable}>
      <body>{children}</body>
    </html>
  );
}
